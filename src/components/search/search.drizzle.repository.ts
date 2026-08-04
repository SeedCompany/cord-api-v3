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

/**
 * Postgres global search.
 *
 * Neo4j stores every string value in a uniform `Property` node, so a single
 * global full-text index covers all resources. Postgres has no such table, so
 * global search is a `UNION ALL` of per-table `ILIKE` matches (`pg_trgm`-style
 * fuzzy/substring — the team's chosen match strategy over `tsvector`). Each
 * branch contributes the columns that map to a DTO field; `matchedProps` are
 * those DTO field names so the service can gate results on field read-perms.
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
 * Known reduction vs Neo4j (Neo4j matched ANY property value): types with no
 * meaningful human-text column — Partner (reachable via its Organization's name
 * through the service's PartnerByOrg path), the Product family, and the
 * PeriodicReport family (date-range identified, no name) — are not TEXT
 * searched, but DO keep exact-id parity (id-only branches). Add a text column
 * to one of those branches if free-text search over it is ever needed.
 *
 * Second known reduction: **result ranking**. Neo4j returns full-text hits ordered
 * by relevance score, so its LIMIT 100 is the best 100 matches. There is no
 * equivalent score here, so rows come back newest-first instead — deterministic
 * and explicable, but not relevance. It only diverges once a query matches more
 * than 100 rows; below that both engines return the same set, just in a different
 * order, and the service re-shapes results by type anyway. `tsvector` ranking
 * would close it if search quality ever becomes the complaint.
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
    const pattern = `%${escapeLikePattern(q)}%`;
    const types = new Set<string>(input.type);

    // One UNION ALL branch per searchable table. `cols` are [column, dtoField]
    // pairs — the column is ILIKE-matched and the DTO field name is what lands
    // in `matchedProps` for the read-perm gate.
    // A `cols` of [] makes an id-only branch (exact-id parity, matchedProps =
    // ['id']) for searchable types with no human-text column.
    // Every searchable table soft-deletes, so every branch filters on it. There
    // used to be an opt-out for periodic_reports; migration 0035 gave that table
    // a `deleted_at` too, and the opt-out went with it.
    const branch = (
      kind: string,
      table: string,
      cols: ReadonlyArray<readonly [column: string, prop: string]>,
      opts: { subtypeCol?: string } = {},
    ): SQL => {
      const { subtypeCol } = opts;
      const cases = [
        sql`case when id = ${q} then 'id' end`,
        ...cols.map(
          ([col, prop]) =>
            sql`case when ${sql.raw(col)} ilike ${pattern} then ${prop} end`,
        ),
      ];
      const conds = [
        sql`id = ${q}`,
        ...cols.map(([col]) => sql`${sql.raw(col)} ilike ${pattern}`),
      ];
      // Cast the enum discriminator to text so every branch's `subtype` column
      // shares one type across the UNION.
      const subtype = subtypeCol
        ? sql`${sql.raw(subtypeCol)}::text`
        : sql`null::text`;
      const match = sql`(${sql.join(conds, sql` or `)})`;
      const where = sql`deleted_at is null and ${match}`;
      return sql`
        select id as id, ${kind} as kind, ${subtype} as subtype,
          created_at as "createdAt",
          array_remove(array[${sql.join(cases, sql`, `)}], null) as "matchedProps"
        from ${sql.raw(table)}
        where ${where}
      `;
    };

    // Same as `branch`, but discriminated by a `type` column and filtered to
    // the requested subtypes (projects, producibles, products, reports).
    const typedBranch = (
      kind: string,
      table: string,
      cols: ReadonlyArray<readonly [column: string, prop: string]>,
      subtypes: readonly string[],
    ): SQL => {
      const base = branch(kind, table, cols, {
        subtypeCol: 'type',
      });
      const list = sql.join(
        subtypes.map((s) => sql`${s}`),
        sql`, `,
      );
      return sql`${base} and type in (${list})`;
    };

    const branches: SQL[] = [];
    if (types.has('Organization')) {
      branches.push(
        branch('Organization', 'organizations', [
          ['name', 'name'],
          ['acronym', 'acronym'],
        ]),
      );
    }
    if (types.has('Language')) {
      branches.push(
        branch('Language', 'languages', [
          ['name', 'name'],
          ['display_name', 'displayName'],
        ]),
      );
    }
    if (types.has('EthnologueLanguage')) {
      // The service rewrites EthnologueLanguage hits to LanguageByEth and
      // overrides matchedProps to ['ethnologue'], so these props are nominal.
      branches.push(
        branch('EthnologueLanguage', 'ethnologue_languages', [
          ['name', 'name'],
          ['code', 'code'],
          ['provisional_code', 'provisionalCode'],
        ]),
      );
    }
    if (types.has('User')) {
      branches.push(
        branch('User', 'users', [
          ['real_first_name', 'realFirstName'],
          ['real_last_name', 'realLastName'],
          ['display_first_name', 'displayFirstName'],
          ['display_last_name', 'displayLastName'],
          ['email', 'email'],
        ]),
      );
    }
    if (types.has('Location')) {
      branches.push(branch('Location', 'locations', [['name', 'name']]));
    }
    if (types.has('FieldZone')) {
      branches.push(branch('FieldZone', 'field_zones', [['name', 'name']]));
    }
    if (types.has('FieldRegion')) {
      branches.push(branch('FieldRegion', 'field_regions', [['name', 'name']]));
    }
    if (types.has('FundingAccount')) {
      branches.push(
        branch('FundingAccount', 'funding_accounts', [['name', 'name']]),
      );
    }
    if (types.has('Tool')) {
      branches.push(
        branch('Tool', 'tools', [
          ['name', 'name'],
          ['description', 'description'],
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
        typedBranch('Project', 'projects', [['name', 'name']], projectSubtypes),
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
          [['name', 'name']],
          producibleSubtypes,
        ),
      );
    }

    // Public searchable types with no meaningful human-text column are not
    // text-searched, but keep exact-id parity with Neo4j's global
    // base-node-by-id arm (id-only branches → matchedProps ['id']).
    if (types.has('Partner')) {
      branches.push(branch('Partner', 'partners', []));
    }
    const productSubtypes = (
      ['DirectScripture', 'Derivative', 'Other'] as const
    ).filter((s) => types.has(PRODUCT_TYPE_LABELS[s]!));
    if (productSubtypes.length) {
      branches.push(typedBranch('Product', 'products', [], productSubtypes));
    }
    const reportSubtypes = (
      ['Financial', 'Narrative', 'Progress'] as const
    ).filter((s) => types.has(`${s}Report`));
    if (reportSubtypes.length) {
      branches.push(
        typedBranch('PeriodicReport', 'periodic_reports', [], reportSubtypes),
      );
    }

    if (branches.length === 0) {
      return [];
    }

    // The count is applied by the service after read-perm filtering; this is
    // just a sane ceiling so we don't return an unbounded set (mirrors Neo4j's
    // own LIMIT 100 and its rationale).
    //
    // The ordering is NOT cosmetic. Neo4j's full-text index returns rows already
    // ranked by relevance, so its LIMIT 100 takes the best 100. A UNION ALL has
    // no such ranking, and an unordered LIMIT lets Postgres return ANY 100 rows —
    // potentially a different 100 for the same query, since nothing obliges it to
    // pick the same plan twice. Ordering newest-first is not relevance, but it is
    // deterministic and explicable, which an arbitrary subset is neither.
    // `id` breaks ties so rows sharing a timestamp (bulk-loaded data does) cannot
    // reorder between runs either.
    const result = await this.db.execute<
      SearchRow & Record<string, unknown>
    >(sql`
      select * from (${sql.join(branches, sql` union all `)}) as results
      order by "createdAt" desc, id
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
