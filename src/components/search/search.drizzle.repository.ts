import { Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { type Merge } from 'type-fest';
import { type ID } from '~/common';
import { DrizzleService } from '~/core/drizzle';
import { escapeLikePattern } from '~/core/drizzle/like';
import { type BaseNode } from '~/core/neo4j/results';
import type { ResourceMap } from '~/core/resources';
import { type SearchInput } from './dto';

interface SearchRow {
  id: ID;
  kind: string;
  subtype: string | null;
  createdAt: string | Date;
  score: number;
  matchedProps: string[];
}

interface SearchResultRow {
  node: BaseNode;
  matchedProps: readonly string[];
}

// products.type enum value → concrete GraphQL type name (not a clean suffix).
const PRODUCT_TYPE_LABELS: Record<string, string> = {
  DirectScripture: 'DirectScriptureProduct',
  Derivative: 'DerivativeScriptureProduct',
  Other: 'OtherProduct',
};

/** [SQL expression to match, DTO field name reported in `matchedProps`] */
type SearchCol = readonly [expr: string, prop: string];

/**
 * Postgres global search.
 *
 * Neo4j stored every string value in a uniform `Property` node, so one global
 * full-text index covered every resource. Postgres has no such table, so global
 * search is a `UNION ALL` of per-table matches. Each branch lists the columns
 * that map to a DTO field; `matchedProps` are those DTO field names so the
 * service can check the requester's read-permission on the field that matched.
 * An exact `id` hit on any branch yields `matchedProps: ['id']`, mirroring the
 * Neo4j base-node-by-id branch.
 *
 * The repo returns the same `{ node, matchedProps }` shape as the Neo4j repo,
 * with `node` a fake {@link BaseNode} (`labels` drive `resolveTypeByBaseNode`),
 * so the DB-agnostic {@link import('./search.service').SearchService} needs no
 * changes.
 *
 * migration-todo: drop at Phase 7 cutover with the rest of the BaseNode shims.
 *
 * ## Matching
 *
 * The Neo4j repo handed Lucene `"<query>"^2 <query>*`: the whole query as a
 * phrase, double-weighted, OR'd with its individual words, the last one a
 * prefix. Three consequences had to be reproduced here, because the first port
 * matched the whole query as one literal `%…%` per column and lost all of them:
 *
 * 1. **Words are matched separately.** Otherwise a person's full name finds
 *    nothing, because the first and last name live in different columns and
 *    neither contains "First Last". The same failure hid words typed out of
 *    order, hyphenated names typed with a space, and names with a comma.
 * 2. **Words are OR'd, and relevance decides the order.** This is Neo4j's
 *    behavior: "Nuer typo" still finds every Nuer. It is only tolerable
 *    because the score below floats the good matches to the top of the 100.
 * 3. **Accents are folded on BOTH sides**, so an unaccented query finds an
 *    accented name and vice versa. Neo4j's `standard-folding` analyzer did
 *    this; `ilike` does not, and language names carry diacritics.
 *
 * Each row is reduced to one "haystack": its searchable columns joined with a
 * space and unaccented ONCE. That is the only per-scanned-row work, and it is
 * what makes a word able to match across a column boundary. Because the
 * separator is a space and words never contain one, a word matching the
 * haystack always matches within a single column, so `matchedProps` stays
 * accurate.
 *
 * Deliberate differences from Neo4j, all of which make search quieter:
 * - **Enum values are not searched** (project step/status/type, and the like).
 *   Neo4j indexed them, so "Active" returned every active project. That is
 *   noise, and it would crowd real matches out of the 100-row ceiling.
 * - **`users.timezone` is not searched**, for the same reason: "America" would
 *   match thousands of people.
 * - **Substrings inside a word match**, which Neo4j could not do (Lucene has no
 *   leading wildcard). This is a superset, not a loss.
 *
 * ## Ranking
 *
 * Neo4j returned hits already ordered by relevance, so its `LIMIT 100` took the
 * best 100. The score below reproduces the shape of the Lucene query rather
 * than its arithmetic: an exact id beats everything, the whole query matched
 * contiguously (Lucene's `^2` phrase boost) beats the same words matched
 * separately, and matching more words beats matching fewer. Ties fall back to
 * newest-first, then `id`, so the order is fully deterministic — an unordered
 * `LIMIT` lets Postgres return any 100 rows, and nothing obliges it to pick the
 * same plan twice.
 *
 * Deliberately NOT Lucene: there is no inverse-document-frequency term and no
 * field-length normalization, so a rare word does not outrank a common one.
 * Add them only if ranking quality is ever the actual complaint.
 *
 * ## Why no index
 *
 * Measured on a production copy (2026-09-22): the text-searched tables hold
 * ~18,000 rows in total, the largest being `projects` at 5,312. A sequential
 * scan computing one `unaccent()` per row is the right tool at that size, and
 * generated `tsvector` columns plus GIN indexes across 13 tables would be a
 * large migration against live production rows for no measurable gain.
 * `products` (81,057) and `periodic_reports` (211,987) are far bigger, so their
 * text columns are the ones to watch; see the note on `productCols` below.
 * If this ever does need an index, `pg_trgm` GIN supports `ilike '%…%'`
 * directly, but note it cannot be applied over `unaccent()` unless that is
 * first wrapped in an IMMUTABLE function, which is a footgun: the wrapper lies
 * about the dictionary being frozen, and the index silently rots if it changes.
 */
@Injectable()
export class SearchDrizzleRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  protected get db() {
    return this.drizzle.client;
  }

  async search(
    input: Merge<SearchInput, { type: Array<keyof ResourceMap> }>,
  ): Promise<readonly SearchResultRow[]> {
    const q = input.query;
    const words = q.split(/\s+/).filter((word) => word.length > 0);
    const types = new Set<string>(input.type);

    const pattern = (value: string) => `%${escapeLikePattern(value)}%`;
    // Built from the normalized words rather than the raw query. The haystack
    // joins columns with exactly one space, so a query that is padded or has a
    // doubled space could never match contiguously and would silently lose the
    // phrase bonus — demoting a full name pasted with a trailing space to the
    // rank of scattered words. Only whitespace is normalized; punctuation
    // stays inside the words.
    const phrasePattern = pattern(words.join(' '));
    const wordPatterns = words.map(pattern);

    // One UNION ALL branch per searchable table. Every searchable table
    // soft-deletes, so every branch filters on it. There used to be an opt-out
    // for periodic_reports; migration 0035 gave that table a `deleted_at` too,
    // and the opt-out went with it.
    // A `cols` of [] makes an id-only branch (exact-id lookup, matchedProps =
    // ['id']). No type passes [] any more — every searchable table turned out
    // to have at least one column Neo4j matched — but the shape is still what
    // a query with no words collapses to, below.
    const branch = (
      kind: string,
      table: string,
      cols: readonly SearchCol[],
      opts: { subtypeCol?: string } = {},
    ): SQL => {
      const { subtypeCol } = opts;
      // A whitespace-only query has no words to match. Collapsing to the
      // id-only shape keeps it from scanning every table for a bare '%%',
      // which would match every row of every table.
      const textCols = words.length > 0 ? cols : [];

      const idMatch = sql`t.id = ${q}`;

      // The haystack. This is the only expression evaluated for every SCANNED
      // row, so it does the accent folding once for the whole row rather than
      // once per column per word. `concat_ws` skips nulls.
      const haystack = textCols.length
        ? sql`unaccent(concat_ws(' ', ${sql.join(
            textCols.map(([expr]) => sql.raw(expr)),
            sql`, `,
          )}))`
        : undefined;
      const wordHits = haystack
        ? wordPatterns.map((p) => sql`h.hay ilike unaccent(${p})`)
        : [];

      const match = wordHits.length
        ? sql`(${idMatch} or ${sql.join(wordHits, sql` or `)})`
        : sql`(${idMatch})`;

      // Everything below is in the SELECT list, so Postgres evaluates it only
      // for rows that already passed the WHERE — its cost scales with hits,
      // not with table size.
      const score = sql.join(
        [
          sql`case when ${idMatch} then 1000 else 0 end`,
          ...(haystack
            ? [
                sql`case when h.hay ilike unaccent(${phrasePattern}) then 100 else 0 end`,
              ]
            : []),
          ...wordHits.map((hit) => sql`case when ${hit} then 10 else 0 end`),
        ],
        sql` + `,
      );

      // Which DTO fields contributed, for the read-permission check. A column
      // contributed if it holds any one of the query's words.
      const cases = [
        sql`case when ${idMatch} then 'id' end`,
        ...textCols.map(([expr, prop]) => {
          const hits = wordPatterns.map(
            (p) => sql`unaccent(${sql.raw(expr)}) ilike unaccent(${p})`,
          );
          return sql`case when ${sql.join(hits, sql` or `)} then ${prop} end`;
        }),
      ];

      // Cast the enum discriminator to text so every branch's `subtype` column
      // shares one type across the UNION.
      const subtype = subtypeCol
        ? sql`${sql.raw(subtypeCol)}::text`
        : sql`null::text`;
      const from = haystack
        ? sql`${sql.raw(table)} t cross join lateral (select ${haystack} as hay) h`
        : sql`${sql.raw(table)} t`;

      return sql`
        select t.id as id, ${kind} as kind, ${subtype} as subtype,
          t.created_at as "createdAt",
          (${score}) as score,
          array_remove(array[${sql.join(cases, sql`, `)}], null) as "matchedProps"
        from ${from}
        where t.deleted_at is null and ${match}
      `;
    };

    // Same as `branch`, but discriminated by a `type` column and filtered to
    // the requested subtypes (projects, producibles, products, reports).
    const typedBranch = (
      kind: string,
      table: string,
      cols: readonly SearchCol[],
      subtypes: readonly string[],
    ): SQL => {
      const base = branch(kind, table, cols, { subtypeCol: 't.type' });
      const list = sql.join(
        subtypes.map((s) => sql`${s}`),
        sql`, `,
      );
      return sql`${base} and t.type in (${list})`;
    };

    const branches: SQL[] = [];
    if (types.has('Organization')) {
      branches.push(
        branch('Organization', 'organizations', [
          ['t.name', 'name'],
          ['t.acronym', 'acronym'],
          ['t.address', 'address'],
        ]),
      );
    }
    if (types.has('Language')) {
      // `name` and `display_name` are adjacent so that a query naming both
      // still lands the contiguous-phrase bonus.
      branches.push(
        branch('Language', 'languages', [
          ['t.name', 'name'],
          ['t.display_name', 'displayName'],
          ['t.display_name_pronunciation', 'displayNamePronunciation'],
          [
            't.registry_of_language_varieties_code',
            'registryOfLanguageVarietiesCode',
          ],
          ['t.sign_language_code', 'signLanguageCode'],
          ['t.least_of_these_reason', 'leastOfTheseReason'],
          // `tags` is text[]; `ilike` against an array is a type error, so it
          // is flattened to a string first. Same for projects below.
          ["array_to_string(t.tags, ' ')", 'tags'],
        ]),
      );
    }
    if (types.has('EthnologueLanguage')) {
      // The service rewrites EthnologueLanguage hits to LanguageByEth and
      // overrides matchedProps to ['ethnologue'], so these props are nominal.
      branches.push(
        branch('EthnologueLanguage', 'ethnologue_languages', [
          ['t.name', 'name'],
          ['t.code', 'code'],
          ['t.provisional_code', 'provisionalCode'],
        ]),
      );
    }
    if (types.has('User')) {
      // First/last adjacent, real before display, so "First Last" typed either
      // way scores the phrase bonus.
      branches.push(
        branch('User', 'users', [
          ['t.real_first_name', 'realFirstName'],
          ['t.real_last_name', 'realLastName'],
          ['t.display_first_name', 'displayFirstName'],
          ['t.display_last_name', 'displayLastName'],
          ['t.email', 'email'],
          ['t.phone', 'phone'],
          ['t.title', 'title'],
          ['t.about', 'about'],
        ]),
      );
    }
    if (types.has('Location')) {
      branches.push(
        branch('Location', 'locations', [
          ['t.name', 'name'],
          ['t.iso_alpha3', 'isoAlpha3'],
        ]),
      );
    }
    if (types.has('FieldZone')) {
      branches.push(branch('FieldZone', 'field_zones', [['t.name', 'name']]));
    }
    if (types.has('FieldRegion')) {
      branches.push(
        branch('FieldRegion', 'field_regions', [['t.name', 'name']]),
      );
    }
    if (types.has('FundingAccount')) {
      // `account_number` is an integer. Neo4j's full-text index only covered
      // string properties, so it was never searchable there either.
      branches.push(
        branch('FundingAccount', 'funding_accounts', [['t.name', 'name']]),
      );
    }
    if (types.has('Tool')) {
      branches.push(
        branch('Tool', 'tools', [
          ['t.name', 'name'],
          ['t.description', 'description'],
        ]),
      );
    }

    const projectSubtypes = (
      [
        'MomentumTranslation',
        'MultiplicationTranslation',
        'Internship',
      ] as const
    ).filter((s) => types.has(`${s}Project`));
    if (projectSubtypes.length) {
      branches.push(
        typedBranch(
          'Project',
          'projects',
          [
            ['t.name', 'name'],
            // How finance staff look a project up. Its absence here was the
            // first post-cutover search report.
            ['t.department_id', 'departmentId'],
            ['t.rev79_project_id', 'rev79ProjectId'],
            ["array_to_string(t.tags, ' ')", 'tags'],
          ],
          projectSubtypes,
        ),
      );
    }

    const producibleSubtypes = (['Film', 'Story', 'EthnoArt'] as const).filter(
      (s) => types.has(s),
    );
    if (producibleSubtypes.length) {
      branches.push(
        typedBranch(
          'Producible',
          'producibles',
          [['t.name', 'name']],
          producibleSubtypes,
        ),
      );
    }

    if (types.has('Partner')) {
      // Also reachable by its Organization's name or address, which the
      // service turns into a PartnerByOrg hit.
      branches.push(
        branch('Partner', 'partners', [
          ['t.pmc_entity_code', 'pmcEntityCode'],
          ['t.address', 'address'],
        ]),
      );
    }
    const productSubtypes = (
      ['DirectScripture', 'Derivative', 'Other'] as const
    ).filter((s) => types.has(PRODUCT_TYPE_LABELS[s]!));
    if (productSubtypes.length) {
      // The two big tables. `products` (81k) and `periodic_reports` (212k)
      // dwarf every other searchable table put together, and a search with no
      // `type` filter includes both. Keep an eye on this pair specifically if
      // search latency is ever reported; they are also the only branches worth
      // indexing before any of the others.
      branches.push(
        typedBranch(
          'Product',
          'products',
          [
            ['t.title', 'title'],
            ['t.description', 'description'],
            ['t.describe_completion', 'describeCompletion'],
            ['t.placeholder_description', 'placeholderDescription'],
            ['t.unspecified_scripture_book', 'unspecifiedScriptureBook'],
          ],
          productSubtypes,
        ),
      );
    }
    const reportSubtypes = (
      ['Financial', 'Narrative', 'Progress'] as const
    ).filter((s) => types.has(`${s}Report`));
    if (reportSubtypes.length) {
      branches.push(
        typedBranch(
          'PeriodicReport',
          'periodic_reports',
          [['t.skipped_reason', 'skippedReason']],
          reportSubtypes,
        ),
      );
    }

    if (branches.length === 0) {
      return [];
    }

    // The count is applied by the service after the read-permission check;
    // this is just a ceiling so we don't return an unbounded set (mirrors
    // Neo4j's own LIMIT 100 and its rationale). Because the rows are ranked,
    // these are the best 100 rather than an arbitrary 100 — see "Ranking".
    const result = await this.db.execute<
      SearchRow & Record<string, unknown>
    >(sql`
      select * from (${sql.join(branches, sql` union all `)}) as results
      order by score desc, "createdAt" desc, id
      limit 100
    `);

    return result.rows.map((row) => ({
      node: this.toBaseNode(row),
      matchedProps: row.matchedProps,
    }));
  }

  private toBaseNode(row: SearchRow): BaseNode {
    const labels =
      row.kind === 'Project'
        ? [`${row.subtype!}Project`, 'Project']
        : row.kind === 'Producible'
          ? [row.subtype!]
          : row.kind === 'Product'
            ? [PRODUCT_TYPE_LABELS[row.subtype!]!]
            : row.kind === 'PeriodicReport'
              ? [`${row.subtype!}Report`]
              : [row.kind];
    return {
      identity: row.id,
      labels: [...labels, 'BaseNode'],
      properties: {
        id: row.id,
        // createdAt is unused by SearchService; parse defensively anyway since
        // raw `db.execute` returns timestamptz as a Postgres wire string.
        createdAt:
          row.createdAt instanceof Date
            ? DateTime.fromJSDate(row.createdAt)
            : DateTime.fromSQL(row.createdAt),
      },
    };
  }
}
