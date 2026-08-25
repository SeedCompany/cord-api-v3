import { getTableName, is, sql, type SQL } from 'drizzle-orm';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { PgTable as PgTableClass } from 'drizzle-orm/pg-core';
import { type DrizzleDb } from '~/core/drizzle/drizzle.service';
import {
  ENGAGEMENT_TYPENAMES,
  PROJECT_TYPENAMES,
} from '~/core/drizzle/resolve-resource-base-node';
import * as schema from '~/core/drizzle/schema';

/**
 * The independent check that a cutover load HOLDS TOGETHER.
 *
 * ## What this is for, and what it is not for
 *
 * The harness already reconciles counts: rows read out of Neo4j against rows
 * written to Postgres, per table. That answers "did everything arrive?" and
 * nothing else. It cannot answer "is what arrived coherent?", because it never
 * looks at the loaded database — only at its own bookkeeping. A load can
 * reconcile perfectly and still hold a report pointing at a file that was never
 * written, or a live membership of a project that is soft-deleted.
 *
 * So this reads ONLY Postgres, and only after the load. Deliberately not built
 * from the ETL's own numbers — same reasoning as the scrub's verifier, and for
 * the same reason: a check derived from the thing it is checking agrees with it
 * by construction.
 *
 * ## It checks what the database cannot check for itself
 *
 * Postgres already enforces its own foreign keys, CHECKs and unique indexes, and
 * re-testing those would only prove the server works. Every check here is one
 * the schema deliberately cannot express:
 *
 * 1. **Unenforced references.** ~24 id-shaped columns carry no FK — some because
 *    the row is inserted before its target exists (the `createDefinedFile`
 *    ordering behind `mou_id`, `report_file_id`, …), some because the target is
 *    polymorphic and there is no single table to point at. Postgres will accept
 *    any string in those. See {@link UNENFORCED}.
 * 2. **Live rows pointing at soft-deleted targets.** A soft-deleted row never
 *    leaves the table, so a foreign key is satisfied by a dead parent exactly as
 *    well as a live one. The FK proves the row EXISTS; nothing proves it is
 *    still alive. This is the whole class of bug the ETL's `liveTargetIds`
 *    guards exist to prevent, checked from the other end.
 * 3. **Subtype agreement.** `media.file_version_id` has a real FK to
 *    `file_nodes`, which cannot say "and it must be a FileVersion, not a
 *    Directory". Same for every `*_type` discriminator: it is a plain text
 *    column, free to disagree with the row it describes.
 * 4. **Timestamp ordering** and **array hygiene**, both derived across the whole
 *    schema rather than listed per table.
 *
 * ## Violations vs watchlist
 *
 * A violation means the LOAD is wrong: something Postgres accepted that the
 * application's own rules say cannot happen. A watchlist entry means the SOURCE
 * is odd and the load carried it faithfully — real, worth knowing, and not a
 * cutover problem. Keeping them apart is what stops the report from being
 * ignored: 6,395 timestamp inversions inherited verbatim from Neo4j would
 * otherwise drown the handful of findings that mean something.
 *
 * ## Reports counts, never values
 *
 * Every finding is a name and a number. That makes the output safe to paste into
 * a ticket or a CI log from a run over production data, which is exactly when it
 * matters most — and it is everything triage needs, since the check itself says
 * where to look.
 */

export interface Finding {
  /** What was checked, e.g. `partnerships.mou_id -> file_nodes`. */
  readonly check: string;
  /** What is wrong with the rows counted, in plain words. */
  readonly detail: string;
  readonly count: number;
}

export interface VerifyReport {
  /** The load is wrong. Non-empty means do not cut over on this data. */
  readonly violations: readonly Finding[];
  /** Faithfully carried source oddities. Worth reading, not worth blocking. */
  readonly watchlist: readonly Finding[];
  /**
   * How many checks actually ran. A check set that quietly shrinks to nothing
   * reports "clean" just like a healthy database — this is how that shows up as
   * a number instead of as silence.
   */
  readonly checksRun: number;
  /**
   * Rows the checks ran over. Reported alongside the verdict because every check
   * counts rows that break a rule, so "no violations" over an empty database is
   * a meaningless pass that reads like a perfect one.
   */
  readonly rowsChecked: number;
  readonly clean: boolean;
}

// ─── The schema, at runtime ──────────────────────────────────────────────────

/**
 * Every `pgTable` the schema module exports, by its SQL name.
 *
 * The `Record<string, unknown>` cast is not cosmetic. `Object.values(schema)`
 * asks TypeScript to form a union of all ~200 schema exports, and a drizzle
 * table's type is enormous — the compiler exhausts its heap and dies before it
 * reports a single error. Erasing the value type first costs nothing here, since
 * the guard below narrows each one anyway.
 */
const TABLES: ReadonlyMap<string, PgTable> = new Map(
  Object.values(schema as Record<string, unknown>)
    .filter((value): value is PgTable => is(value, PgTableClass))
    .map((table) => [getTableName(table), table] as const),
);

const columnNames = (table: PgTable): ReadonlySet<string> =>
  new Set(getTableConfig(table).columns.map((column) => column.name));

const hasColumn = (table: PgTable, name: string) =>
  columnNames(table).has(name);

/** `"alias"."column"`, so generated SQL quotes identifiers rather than pasting. */
const col = (alias: string, name: string) =>
  sql`${sql.identifier(alias)}.${sql.identifier(name)}`;

const from = (table: PgTable, alias: string) =>
  sql`${sql.identifier(getTableName(table))} ${sql.identifier(alias)}`;

/** `count(*)` arrives as a bigint (i.e. a string); no table here approaches 2^31. */
const runCount = async (db: DrizzleDb, query: SQL): Promise<number> => {
  const result = await db.execute<{ n: number }>(query);
  return Number(result.rows[0]?.n ?? 0);
};

const countWhere = async (db: DrizzleDb, table: PgTable, where: SQL) =>
  await runCount(
    db,
    sql`select count(*)::int as n from ${from(table, 'c')} where ${where}`,
  );

/** `c.<column>` has no row in `target`. */
const noRowIn = (target: PgTable, childColumn: SQL, alias = 't') =>
  sql`not exists (select 1 from ${from(target, alias)} where ${col(
    alias,
    'id',
  )} = ${childColumn})`;

// ─── 1. References Postgres does not enforce ─────────────────────────────────

const { budgets, budgetRecords, ceremonies, comments, commentThreads } = schema;
const { educations, engagements, fieldRegions, fieldZones, fileNodes } = schema;
const { fundingAccounts, languages, locations, notifications } = schema;
const { organizations, partners, partnerships, periodicReports } = schema;
const { posts, producibles, products, projectMembers, projects } = schema;
const { tools, toolUsages, unavailabilities, users } = schema;

/**
 * Concrete `__typename` → the table its rows live in.
 *
 * Mirrors `RESOURCE_TABLES` in resolve-resource-base-node.ts, which is the
 * registry the running application uses for the same job. Not imported from it
 * because that registry exposes query branches rather than tables — but the two
 * subtype FAMILIES most likely to gain a member are imported, so adding a
 * project or engagement type updates this map without anyone remembering to.
 *
 * A stored type this map does not claim is reported as a violation rather than
 * skipped. That is the point: an unmapped type and a dangling id look identical
 * from the outside, and only one of them is a data problem.
 *
 * Built entry by entry rather than as one array literal, for the same reason
 * {@link TABLES} erases its value type: a single literal makes TypeScript infer
 * a union of thirty-odd drizzle table types and run out of memory.
 */
const named = (
  typenames: readonly string[],
  table: PgTable,
): ReadonlyArray<readonly [string, PgTable]> =>
  typenames.map((typename) => [typename, table] as const);

const TABLE_BY_TYPENAME: ReadonlyMap<string, PgTable> = new Map([
  ...named(PROJECT_TYPENAMES, projects),
  ...named(ENGAGEMENT_TYPENAMES, engagements),
  ...named(['User'], users),
  ...named(['Language'], languages),
  ...named(['Partner'], partners),
  ...named(['Organization'], organizations),
  ...named(['Location'], locations),
  ...named(['FieldRegion'], fieldRegions),
  ...named(['FieldZone'], fieldZones),
  ...named(['FundingAccount'], fundingAccounts),
  ...named(['Partnership'], partnerships),
  ...named(['Budget'], budgets),
  ...named(['BudgetRecord'], budgetRecords),
  ...named(['Ceremony'], ceremonies),
  ...named(['ProjectMember'], projectMembers),
  ...named(['Unavailability'], unavailabilities),
  ...named(['Education'], educations),
  ...named(['Tool'], tools),
  ...named(['ToolUsage'], toolUsages),
  ...named(['Comment'], comments),
  ...named(['CommentThread'], commentThreads),
  ...named(['Post'], posts),
  ...named(
    ['ProgressReport', 'FinancialReport', 'NarrativeReport'],
    periodicReports,
  ),
  ...named(
    ['DirectScriptureProduct', 'DerivativeScriptureProduct', 'OtherProduct'],
    products,
  ),
  ...named(['Film', 'Story', 'EthnoArt'], producibles),
  ...named(['Directory', 'File', 'FileVersion'], fileNodes),
  ...named(
    ['SystemNotification', 'CommentViaMentionNotification'],
    notifications,
  ),
]);

/** How a column with no foreign key behind it should be read. */
type ReferenceKind =
  /** Always points at one table. A dangling value is a violation. */
  | { readonly kind: 'points-at'; readonly target: PgTable }
  /** Points at whichever table a sibling `*_type` column names. */
  | { readonly kind: 'polymorphic'; readonly typeColumn: string }
  /** Points at one of several tables, with nothing stored to say which. */
  | { readonly kind: 'any-of'; readonly targets: readonly PgTable[] }
  /** Not a reference into this database at all — nothing to check. */
  | { readonly kind: 'not-a-reference' };

type UnenforcedReference = ReferenceKind & {
  /** SQL names, because they are what the catalogue is compared against. */
  readonly table: string;
  readonly column: string;
  readonly why: string;
};

/**
 * Every id-shaped column carrying no foreign key, and what it actually means.
 *
 * Completeness is enforced, not assumed — {@link assertEveryUnenforcedColumnIsClassified}
 * walks the schema and refuses to run if a column is missing here. Without that
 * this list would rot the moment someone added a column, and rot INVISIBLY: the
 * check set would quietly shrink and keep reporting clean.
 *
 * Written as a flat list rather than nested by table so that each entry names
 * its own table and column. The keys would otherwise be snake_case object
 * properties, and this way the SQL names stay values — which is what they are,
 * since they are compared against `information_schema` rather than dereferenced.
 */
const UNENFORCED: readonly UnenforcedReference[] = [
  {
    table: 'users',
    column: 'photo_id',
    kind: 'points-at',
    target: fileNodes,
    why: 'DefinedFile placeholder — the row is written before the file node exists',
  },
  {
    table: 'locations',
    column: 'map_image_id',
    kind: 'points-at',
    target: fileNodes,
    why: 'DefinedFile placeholder',
  },
  {
    table: 'partners',
    column: 'language_of_wider_communication_id',
    kind: 'points-at',
    target: languages,
    why: 'deferred FK → languages(id); the real one lands when Language migrates',
  },
  {
    table: 'partners',
    column: 'language_of_reporting_id',
    kind: 'points-at',
    target: languages,
    why: 'deferred FK → languages(id); the real one lands when Language migrates',
  },
  {
    table: 'partner_languages_of_consulting',
    column: 'language_id',
    kind: 'points-at',
    target: languages,
    why: 'deferred FK → languages(id); one half of this junction is enforced, this half is not',
  },
  {
    table: 'partnerships',
    column: 'mou_id',
    kind: 'points-at',
    target: fileNodes,
    why: 'DefinedFile placeholder — createDefinedFile runs after this insert',
  },
  {
    table: 'partnerships',
    column: 'agreement_id',
    kind: 'points-at',
    target: fileNodes,
    why: 'DefinedFile placeholder — createDefinedFile runs after this insert',
  },
  {
    table: 'budgets',
    column: 'universal_template_file_id',
    kind: 'points-at',
    target: fileNodes,
    why: 'DefinedFile placeholder — same ordering as partnerships.mou_id',
  },
  {
    table: 'engagements',
    column: 'pnp_id',
    kind: 'points-at',
    target: fileNodes,
    why: 'DefinedFile placeholder',
  },
  {
    table: 'engagements',
    column: 'growth_plan_id',
    kind: 'points-at',
    target: fileNodes,
    why: 'DefinedFile placeholder',
  },
  {
    table: 'engagements',
    column: 'paratext_registry_id',
    kind: 'not-a-reference',
    why: "Paratext's own registry id — another system's string",
  },
  {
    table: 'engagements',
    column: 'rev79_community_id',
    kind: 'not-a-reference',
    why: "Rev79's community id — another system's string",
  },
  {
    table: 'engagements',
    column: 'web_id',
    kind: 'not-a-reference',
    why: 'an id carried for outside reporting, not a row in this database',
  },
  {
    table: 'projects',
    column: 'rev79_project_id',
    kind: 'not-a-reference',
    why: "Rev79's project id — another system's string",
  },
  {
    table: 'projects',
    column: 'department_id',
    kind: 'not-a-reference',
    why: 'a finance department NUMBER allocated out of a department_id_block, not a row id',
  },
  {
    table: 'external_department_ids',
    column: 'department_id',
    kind: 'not-a-reference',
    // The same kind of value as projects.department_id above, which is why it
    // sits beside it — and here it is also the primary key, because the
    // reservation IS the number. There is deliberately nothing to point at: the
    // whole purpose of the table is to name department numbers that Intacct
    // holds and CORD has no row for.
    why:
      'a finance department NUMBER that Intacct already holds — reserved so ' +
      'CORD never hands the same one out, not a row id',
  },
  {
    table: 'periodic_reports',
    column: 'report_file_id',
    kind: 'points-at',
    target: fileNodes,
    why: 'DefinedFile placeholder — the report row precedes its file rows',
  },
  {
    table: 'periodic_reports',
    column: 'narrative_file_id',
    kind: 'points-at',
    target: fileNodes,
    why: 'DefinedFile placeholder — the report row precedes its file rows',
  },
  {
    table: 'progress_report_media',
    column: 'file_id',
    kind: 'points-at',
    target: fileNodes,
    why: 'DefinedFile placeholder — created by createDefinedFile after this row',
  },
  {
    table: 'progress_report_media',
    column: 'variant_group_id',
    kind: 'not-a-reference',
    why: 'a grouping key shared by the variants of one upload; no table holds it',
  },
  {
    table: 'prompt_variant_responses',
    column: 'parent_id',
    kind: 'points-at',
    target: periodicReports,
    why: 'always a progress report — the Cypher matches any BaseNode, but only reports carry these',
  },
  {
    table: 'comment_threads',
    column: 'parent_id',
    kind: 'polymorphic',
    typeColumn: 'parent_type',
    why: 'a thread hangs off any commentable resource',
  },
  {
    table: 'posts',
    column: 'parent_id',
    kind: 'polymorphic',
    typeColumn: 'parent_type',
    why: 'a post hangs off a Language, Partner or Project',
  },
  {
    table: 'tool_usages',
    column: 'container_id',
    kind: 'polymorphic',
    typeColumn: 'container_type',
    why: 'a tool is used on a Project, Engagement, Language or Product',
  },
  {
    table: 'resource_mutations',
    column: 'resource_id',
    kind: 'not-a-reference',
    // Classified as polymorphic at first, which was wrong, and a probe run
    // against a database with real app traffic said so: 108 findings on the e2e
    // database, every one of them correct behaviour. The trail holds 330 Comment
    // Creates and 18 Comment Deletes against 3 surviving comments — comments and
    // posts hard-delete, so an entry recording a deletion MUST outlive the row it
    // names. Following it would turn the whole audit log into violations.
    why:
      'a historical snapshot, not a live pointer — the resource it names may ' +
      'since have been hard-deleted, which is exactly what an append-only trail ' +
      'is for. Same reasoning as the actor_system_agent column beside it.',
  },
  {
    table: 'pins',
    column: 'resource_id',
    kind: 'any-of',
    targets: [
      projects,
      languages,
      partners,
      engagements,
      users,
      organizations,
      locations,
      products,
      periodicReports,
      fileNodes,
    ],
    why: 'a user can pin any resource, and nothing is stored to say which kind',
  },
];

/** `table.column` for every entry above — the guard compares against this. */
const CLASSIFIED: ReadonlySet<string> = new Set(
  UNENFORCED.map((reference) => `${reference.table}.${reference.column}`),
);

/**
 * An id-shaped column with no foreign key must appear in {@link UNENFORCED}.
 *
 * The inverse guard, and the reason this file can be trusted a year from now.
 * Every check below iterates the manifest, so a column nobody classified is not
 * checked — and an unchecked column produces no finding, which reads exactly
 * like a clean one. The same shape as the scrub's `assertFullyClassified`, and
 * added for the same reason the ETL's own coverage gaps were only found by
 * counting from both ends.
 *
 * Throws rather than warns: a run that cannot say what it covers should not
 * print a verdict.
 */
export const assertEveryUnenforcedColumnIsClassified = () => {
  const unclassified: string[] = [];
  for (const [tableName, table] of TABLES) {
    const config = getTableConfig(table);
    const enforced = new Set(
      config.foreignKeys.flatMap((key) =>
        key.reference().columns.map((column) => column.name),
      ),
    );
    for (const column of config.columns) {
      if (!/_ids?$/.test(column.name)) continue;
      if (enforced.has(column.name)) continue;
      if (CLASSIFIED.has(`${tableName}.${column.name}`)) continue;
      unclassified.push(`${tableName}.${column.name}`);
    }
  }
  if (unclassified.length > 0) {
    throw new Error(
      `Refusing to verify: ${unclassified.length} id-shaped column(s) carry no ` +
        `foreign key and are not classified in UNENFORCED — this check cannot ` +
        `say whether they hold anything real. Classify them (points-at / ` +
        `polymorphic / any-of / not-a-reference) and re-run: ` +
        unclassified.join(', '),
    );
  }
};

const checkUnenforcedReferences = async (
  db: DrizzleDb,
): Promise<{ findings: Finding[]; checksRun: number }> => {
  const findings: Finding[] = [];
  let checksRun = 0;

  for (const reference of UNENFORCED) {
    if (reference.kind === 'not-a-reference') continue;
    const { table: tableName, column: columnName } = reference;
    const table = TABLES.get(tableName)!;
    const value = col('c', columnName);
    const present = sql`${value} is not null`;

    if (reference.kind === 'points-at') {
      checksRun++;
      const count = await countWhere(
        db,
        table,
        sql`${present} and ${noRowIn(reference.target, value)}`,
      );
      if (count > 0) {
        findings.push({
          check: `${tableName}.${columnName} → ${getTableName(
            reference.target,
          )}`,
          detail: `points at a row that does not exist (${reference.why})`,
          count,
        });
      }
      continue;
    }

    if (reference.kind === 'any-of') {
      checksRun++;
      // Distinct aliases: these NOT EXISTS clauses sit side by side.
      const clauses = reference.targets.map((target, index) =>
        noRowIn(target, value, `t${index}`),
      );
      const count = await countWhere(
        db,
        table,
        sql`${present} and ${sql.join(clauses, sql` and `)}`,
      );
      if (count > 0) {
        findings.push({
          check: `${tableName}.${columnName} → any resource`,
          detail:
            `points at a row in none of the ${reference.targets.length} tables ` +
            `it could be in (${reference.why})`,
          count,
        });
      }
      continue;
    }

    // Polymorphic: ask the data which types are actually present, then check
    // each against its own table. Driving off the STORED values rather than off
    // the map is what lets an unmapped type be reported instead of skipped —
    // the map cannot know what it is missing.
    const typeColumn = col('c', reference.typeColumn);
    const storedTypes = await db.execute<{ type: string; n: number }>(
      sql`select ${typeColumn} as type, count(*)::int as n
          from ${from(table, 'c')} where ${present} group by 1`,
    );
    for (const row of storedTypes.rows) {
      checksRun++;
      const target = TABLE_BY_TYPENAME.get(row.type);
      if (!target) {
        findings.push({
          check: `${tableName}.${reference.typeColumn} = ${row.type}`,
          detail:
            'no table is registered for this type, so the rows carrying it ' +
            'cannot be checked at all — either the stored type is wrong or ' +
            'TABLE_BY_TYPENAME is behind the schema',
          count: Number(row.n),
        });
        continue;
      }
      const count = await countWhere(
        db,
        table,
        sql`${typeColumn} = ${row.type} and ${noRowIn(target, value)}`,
      );
      if (count > 0) {
        findings.push({
          check: `${tableName}.${columnName} (${row.type}) → ${getTableName(
            target,
          )}`,
          detail: `points at a row that does not exist (${reference.why})`,
          count,
        });
      }
    }
  }
  return { findings, checksRun };
};

// ─── 2. Live rows pointing at soft-deleted targets ───────────────────────────

/**
 * A foreign key proves the target row EXISTS. It cannot prove the target is
 * still alive, because Neo4j's soft delete became a `deleted_at` column here and
 * the row never leaves the table.
 *
 * Derived from the catalogue rather than listed: every real FK whose target
 * table soft-deletes, plus every `points-at` entry above. A child with no
 * `deleted_at` of its own is always live, so it is checked too — a hard-deleted
 * comment on a soft-deleted post is the same bug.
 *
 * Applied to every edge without exception, and that is a statement about the
 * LOAD rather than about the application. The ETL drops any row whose target
 * did not land alive (`liveTargetIds`), so a correct load contains none of these
 * by construction — and the 2026-08-20 production-scale load indeed reports zero
 * across all 102 edges. Anything here means a guard was missed.
 *
 * That is not the same rule a long-running application would want. Deactivating
 * a user does not invalidate the files they created, so `file_nodes.created_by_id`
 * pointing at a departed user is ordinary once the app is live. Read a finding
 * here as "the load did not reproduce the source's liveness", not as "the app is
 * broken".
 */
const checkDeadTargets = async (
  db: DrizzleDb,
): Promise<{ findings: Finding[]; checksRun: number }> => {
  const findings: Finding[] = [];
  let checksRun = 0;

  const edges: Array<{
    child: PgTable;
    childColumn: string;
    target: PgTable;
    targetColumn: string;
  }> = [];

  for (const table of TABLES.values()) {
    for (const key of getTableConfig(table).foreignKeys) {
      const reference = key.reference();
      // Composite foreign keys would need a composite anti-join; none of the
      // schema's FKs are composite, and asserting that is cheaper than writing
      // the general case for a shape that does not occur.
      if (reference.columns.length !== 1) continue;
      edges.push({
        child: table,
        childColumn: reference.columns[0]!.name,
        target: reference.foreignTable,
        targetColumn: reference.foreignColumns[0]!.name,
      });
    }
  }
  for (const reference of UNENFORCED) {
    if (reference.kind !== 'points-at') continue;
    edges.push({
      child: TABLES.get(reference.table)!,
      childColumn: reference.column,
      target: reference.target,
      targetColumn: 'id',
    });
  }

  for (const edge of edges) {
    if (!hasColumn(edge.target, 'deleted_at')) continue;
    checksRun++;
    const childLive = hasColumn(edge.child, 'deleted_at')
      ? sql`${col('c', 'deleted_at')} is null and `
      : sql``;
    const count = await runCount(
      db,
      sql`select count(*)::int as n
          from ${from(edge.child, 'c')}
          join ${from(edge.target, 't')}
            on ${col('t', edge.targetColumn)} = ${col('c', edge.childColumn)}
          where ${childLive}${col('t', 'deleted_at')} is not null`,
    );
    if (count > 0) {
      findings.push({
        check: `${getTableName(edge.child)}.${edge.childColumn} → ${getTableName(
          edge.target,
        )}`,
        detail:
          'live row whose target is soft-deleted — the foreign key is satisfied ' +
          'by a dead row, so nothing in the database catches this',
        count,
      });
    }
  }
  return { findings, checksRun };
};

// ─── 3. Subtype agreement ────────────────────────────────────────────────────

/**
 * Where a foreign key points at the right TABLE but cannot say which KIND of row.
 *
 * These have to be written out: nothing in the schema records that a
 * `progress_report_media` row belongs to a *Progress* report specifically, or
 * that `media.file_version_id` must be a FileVersion rather than a Directory.
 * The FK is satisfied either way, and the read path would simply return the
 * wrong thing.
 */
const SUBTYPE_AGREEMENT: ReadonlyArray<{
  check: string;
  detail: string;
  where: SQL;
}> = [
  {
    check: 'media.file_version_id → file_nodes',
    detail: 'points at a file node that is not a FileVersion',
    where: sql`select count(*)::int as n from ${from(schema.media, 'c')}
      join ${from(fileNodes, 't')} on ${col('t', 'id')} = ${col(
        'c',
        'file_version_id',
      )}
      where ${col('t', 'type')} <> 'FileVersion'`,
  },
  {
    check: 'projects.root_directory_id → file_nodes',
    detail:
      "points at a file node that is not a Directory, so the project's tree has no root",
    where: sql`select count(*)::int as n from ${from(projects, 'c')}
      join ${from(fileNodes, 't')} on ${col('t', 'id')} = ${col(
        'c',
        'root_directory_id',
      )}
      where ${col('t', 'type')} <> 'Directory'`,
  },
  {
    check: 'file_nodes.latest_version_id',
    detail:
      'points at a node that is not a FileVersion of THIS file — the self-FK only ' +
      'requires some file node, so a file can advertise another file’s version',
    where: sql`select count(*)::int as n from ${from(fileNodes, 'c')}
      where ${col('c', 'latest_version_id')} is not null
        and not exists (select 1 from ${from(fileNodes, 'v')}
          where ${col('v', 'id')} = ${col('c', 'latest_version_id')}
            and ${col('v', 'type')} = 'FileVersion'
            and ${col('v', 'parent_id')} = ${col('c', 'id')})`,
  },
  {
    check: 'file_nodes.parent_id',
    detail:
      'sits under the wrong kind of node — a File must hang off a Directory, a ' +
      'FileVersion off a File, and a Directory off another Directory',
    where: sql`select count(*)::int as n from ${from(fileNodes, 'c')}
      join ${from(fileNodes, 'p')} on ${col('p', 'id')} = ${col(
        'c',
        'parent_id',
      )}
      where (${col('c', 'type')} = 'File' and ${col('p', 'type')} <> 'Directory')
         or (${col('c', 'type')} = 'FileVersion' and ${col(
           'p',
           'type',
         )} <> 'File')
         or (${col('c', 'type')} = 'Directory' and ${col(
           'p',
           'type',
         )} <> 'Directory')`,
  },
  {
    check: 'progress_report_media.report_id → periodic_reports',
    detail: 'hangs off a report that is not a Progress report',
    where: sql`select count(*)::int as n from ${from(
      schema.progressReportMedia,
      'c',
    )}
      join ${from(periodicReports, 't')} on ${col('t', 'id')} = ${col(
        'c',
        'report_id',
      )}
      where ${col('t', 'type')} <> 'Progress'`,
  },
  {
    check: 'progress_report_variance_explanations.report_id → periodic_reports',
    detail: 'hangs off a report that is not a Progress report',
    where: sql`select count(*)::int as n from ${from(
      schema.progressReportVarianceExplanations,
      'c',
    )}
      join ${from(periodicReports, 't')} on ${col('t', 'id')} = ${col(
        'c',
        'report_id',
      )}
      where ${col('t', 'type')} <> 'Progress'`,
  },
  {
    check: 'progress_report_workflow_events.report_id → periodic_reports',
    detail: 'hangs off a report that is not a Progress report',
    where: sql`select count(*)::int as n from ${from(
      schema.progressReportWorkflowEvents,
      'c',
    )}
      join ${from(periodicReports, 't')} on ${col('t', 'id')} = ${col(
        'c',
        'report_id',
      )}
      where ${col('t', 'type')} <> 'Progress'`,
  },
  {
    check: 'prompt_variant_responses.parent_id → periodic_reports',
    detail: 'hangs off a report that is not a Progress report',
    where: sql`select count(*)::int as n from ${from(
      schema.promptVariantResponses,
      'c',
    )}
      join ${from(periodicReports, 't')} on ${col('t', 'id')} = ${col(
        'c',
        'parent_id',
      )}
      where ${col('t', 'type')} <> 'Progress'`,
  },
  {
    check: 'posts.parent_type vs projects.type',
    detail:
      'the stored type names a different project kind than the project row does, ' +
      'so the resolver would look in the right table for the wrong subtype',
    where: sql`select count(*)::int as n from ${from(posts, 'c')}
      join ${from(projects, 'p')} on ${col('p', 'id')} = ${col('c', 'parent_id')}
      where ${col('c', 'parent_type')} <> ${col('p', 'type')} || 'Project'`,
  },
  {
    check: 'comment_threads.parent_type vs projects.type',
    detail:
      'the stored type names a different project kind than the project row does',
    where: sql`select count(*)::int as n from ${from(commentThreads, 'c')}
      join ${from(projects, 'p')} on ${col('p', 'id')} = ${col('c', 'parent_id')}
      where ${col('c', 'parent_type')} <> ${col('p', 'type')} || 'Project'`,
  },
  {
    check: 'tool_usages.container_type vs projects.type',
    detail:
      'the stored type names a different project kind than the project row does',
    where: sql`select count(*)::int as n from ${from(toolUsages, 'c')}
      join ${from(projects, 'p')} on ${col('p', 'id')} = ${col(
        'c',
        'container_id',
      )}
      where ${col('c', 'container_type')} <> ${col('p', 'type')} || 'Project'`,
  },
  {
    check: 'tool_usages.container_type vs engagements.type',
    detail:
      'the stored type names a different engagement kind than the engagement row does',
    where: sql`select count(*)::int as n from ${from(toolUsages, 'c')}
      join ${from(engagements, 'e')} on ${col('e', 'id')} = ${col(
        'c',
        'container_id',
      )}
      where ${col('c', 'container_type')} <> ${col('e', 'type')} || 'Engagement'`,
  },
];

const checkSubtypeAgreement = async (db: DrizzleDb) => {
  const findings: Finding[] = [];
  for (const check of SUBTYPE_AGREEMENT) {
    const count = await runCount(db, check.where);
    if (count > 0) {
      findings.push({ check: check.check, detail: check.detail, count });
    }
  }
  return { findings, checksRun: SUBTYPE_AGREEMENT.length };
};

// ─── 4. Array hygiene ────────────────────────────────────────────────────────

/**
 * Enum arrays stand in for Neo4j's repeated property edges — `roles`, `types`,
 * `steps`. Nothing stops the same value being written twice, and a duplicate
 * role is invisible until something counts them.
 *
 * A NULL inside the array is worse than a duplicate: `'Manager' = any(roles)`
 * still works, but `not ('X' = any(roles))` becomes NULL rather than true, so a
 * negative filter silently stops matching the row.
 */
const checkArrays = async (db: DrizzleDb) => {
  const findings: Finding[] = [];
  let checksRun = 0;
  for (const [tableName, table] of TABLES) {
    for (const column of getTableConfig(table).columns) {
      if (column.dataType !== 'array') continue;
      checksRun++;
      const value = col('c', column.name);
      const duplicates = await countWhere(
        db,
        table,
        sql`cardinality(${value}) <> cardinality(array(select distinct unnest(${value})))`,
      );
      if (duplicates > 0) {
        findings.push({
          check: `${tableName}.${column.name}`,
          detail: 'array holds the same value more than once',
          count: duplicates,
        });
      }
      const nulls = await countWhere(
        db,
        table,
        sql`array_position(${value}, null) is not null`,
      );
      if (nulls > 0) {
        findings.push({
          check: `${tableName}.${column.name}`,
          detail:
            'array holds a NULL element, which turns every negative filter over ' +
            'this column into NULL and silently stops matching the row',
          count: nulls,
        });
      }
    }
  }
  return { findings, checksRun };
};

// ─── 5. Timestamp ordering (watchlist) ───────────────────────────────────────

/**
 * A row modified or deleted BEFORE it was created.
 *
 * Watchlist, not violation, and the distinction was measured rather than
 * assumed. On the 2026-08-20 production-scale load this reports 6,395 rows, and
 * every one is inherited: Neo4j stores `createdAt` on the node but `modifiedAt`
 * as a separate property record, and nothing has ever kept the two in order.
 * The source graph holds 2,184 posts whose `modifiedAt` predates their
 * `createdAt` by more than a day — the worst by 2,864 days — and Postgres holds
 * exactly those same rows. The remainder differ by a millisecond or two, which
 * is just two clock reads inside one transaction.
 *
 * So a non-zero count here is not a load defect and must not block a cutover. It
 * is worth reporting because a count that MOVES means the ETL started inventing
 * timestamps, which is a real failure mode — the variance-explanation extractor
 * stamped all 5,729 of its rows with `new Date()` until 2026-08-19.
 */
const checkTimestampOrder = async (db: DrizzleDb) => {
  const findings: Finding[] = [];
  let checksRun = 0;
  for (const [tableName, table] of TABLES) {
    const columns = columnNames(table);
    if (!columns.has('created_at')) continue;
    for (const later of ['updated_at', 'modified_at', 'deleted_at']) {
      if (!columns.has(later)) continue;
      checksRun++;
      const count = await countWhere(
        db,
        table,
        sql`${col('c', later)} is not null and ${col('c', later)} < ${col(
          'c',
          'created_at',
        )}`,
      );
      if (count > 0) {
        findings.push({
          check: `${tableName}.${later}`,
          detail: `stamped before the row's own created_at`,
          count,
        });
      }
    }
  }
  return { findings, checksRun };
};

// ─── 6. Unreachable file nodes (watchlist) ───────────────────────────────────

/**
 * Files and versions with no parent, i.e. nothing above them in the tree.
 *
 * All faithful, and all measured against the source rather than assumed: Neo4j
 * holds 783,810 `:File` nodes with no active `parent` edge and 9,645 such
 * `:FileVersion` nodes, and the load carries the same population (783,722 /
 * 9,645 — the gap is exactly the 88 nodes the extractor dropped for a missing
 * creator).
 *
 * Split three ways, because one number covering all of them said something
 * untrue. The first version of this reported both types with the same sentence,
 * "mostly DefinedFile placeholders that were never uploaded to" — true of most
 * Files and impossible for a FileVersion, which IS an upload. Worse, it buried
 * the one population that means anything inside a total 500× its size.
 *
 * - **Reachable by a column.** A `DefinedFile` has no parent directory BY
 *   DESIGN: `createDefinedFile` makes it for a specific field, and it is found
 *   through `partnerships.mou_id` and friends rather than through the tree.
 *   Working as intended; counted only to account for the bulk of the total.
 * - **Holds uploads that nothing references.** No parent, no column pointing at
 *   it, and yet real content beneath it: 1,541 files / 1,636 versions / 871 MB
 *   on the 2026-08-20 load. Traced to source 2026-08-20 and it splits in two.
 *   **1,082 are unreachable in Neo4j as well**, and they got that way through
 *   `deleteBaseNode`, which deactivates every INBOUND relationship of the node
 *   it deletes — a child's `parent` edge points AT its parent, so deleting a
 *   directory severs every child's link and leaves the children fully alive,
 *   labels intact. 176 deleted directories did this to 1,082 Files and 20
 *   Directories, spread evenly over 2021–2026, most recently 2026-07-13.
 *   Verified by applying the generated Cypher to throwaway nodes: the child
 *   keeps its labels, carries no `deletedAt`, and its edge reads `active: false`.
 *   **The Postgres arm already fixes this**, deliberately — `delete()` walks the
 *   subtree with a recursive CTE (accepted 2026-07-14, pre-cutover audit F1) —
 *   so the code stops producing these at cutover, but the historical rows come
 *   across as-is and nothing will ever reattach them.
 *   The other ~459 are reachable in Neo4j and not here, because the owner
 *   holding the reference did not land: 435 have a soft-deleted owner
 *   (`fileNode` 396, `pnpNode` 34, `growthPlanNode` 4, `reportFileNode` 1) and
 *   the rest belong to the 7,011 reports lost to a dead project two levels up.
 *   Those are consequences of drops already accounted for, not new damage.
 * - **Versions of a deleted File.** Every one of the 9,645 has a `parent` edge
 *   that was DEACTIVATED, and in all 9,645 cases the node on the other end is a
 *   `Deleted_File`. So these are the version history of deleted files, kept
 *   because the version's own label survives the parent's deletion. Unreachable
 *   in Neo4j and Postgres alike.
 *
 * The referenced set is derived from {@link UNENFORCED} rather than written out,
 * so a new `DefinedFile` column moves files out of the stranded count on its own.
 */
const checkOrphanFileNodes = async (db: DrizzleDb) => {
  const findings: Finding[] = [];
  const fileColumns = UNENFORCED.filter(
    (reference) =>
      reference.kind === 'points-at' && reference.target === fileNodes,
  );
  const referenced = sql.join(
    fileColumns.map(
      (reference) =>
        sql`select ${sql.identifier(reference.column)} as id
            from ${sql.identifier(reference.table)}
            where ${sql.identifier(reference.column)} is not null`,
    ),
    sql` union `,
  );

  // Joins, and `as materialized`, both deliberate. Written first with correlated
  // `exists (select 1 from referenced …)` per row, which is the natural way to
  // say it and does not finish: a CTE used ONCE is inlined, so the whole union
  // was re-evaluated for each of 783,722 rows and the run had to be killed at ten
  // minutes. As three sets joined instead, it is 2 seconds. Left joins rather
  // than NOT EXISTS so one pass answers all three counts.
  const [counts] = (
    await db.execute<{
      stranded: number;
      byColumn: number;
      placeholder: number;
    }>(
      sql`with referenced(id) as materialized (${referenced}),
          parentless as (
            select ${col('f', 'id')} as id from ${from(fileNodes, 'f')}
            where ${col('f', 'type')} = 'File' and ${col('f', 'parent_id')} is null
          ),
          uploaded(id) as materialized (
            select distinct ${col('v', 'parent_id')} from ${from(fileNodes, 'v')}
            where ${col('v', 'type')} = 'FileVersion'
              and ${col('v', 'parent_id')} is not null
          )
          select
            count(*) filter (where u.id is not null and r.id is null)::int as "stranded",
            count(*) filter (where r.id is not null)::int as "byColumn",
            count(*) filter (where u.id is null and r.id is null)::int as "placeholder"
          from parentless p
          left join referenced r on r.id = p.id
          left join uploaded u on u.id = p.id`,
    )
  ).rows;

  if (counts && Number(counts.stranded) > 0) {
    findings.push({
      check: 'file_nodes (File, stranded)',
      detail:
        'holds uploaded versions but has no parent folder AND no column pointing ' +
        'at it, so nothing in the application can reach the content',
      count: Number(counts.stranded),
    });
  }
  if (counts && Number(counts.byColumn) > 0) {
    findings.push({
      check: 'file_nodes (File, by column)',
      detail:
        'no parent folder, which is how a DefinedFile is meant to sit — found ' +
        'through mou_id / report_file_id / photo_id and the rest, not the tree',
      count: Number(counts.byColumn),
    });
  }
  if (counts && Number(counts.placeholder) > 0) {
    findings.push({
      check: 'file_nodes (File, empty)',
      detail:
        'no parent, no uploads, and nothing references it — an upload slot that ' +
        'was created and never used',
      count: Number(counts.placeholder),
    });
  }

  const versions = await countWhere(
    db,
    fileNodes,
    sql`${col('c', 'type')} = 'FileVersion' and ${col('c', 'parent_id')} is null`,
  );
  if (versions > 0) {
    findings.push({
      check: 'file_nodes (FileVersion, orphaned)',
      detail:
        "its File was deleted — the version outlives the parent because Neo4j's " +
        'soft delete strips the parent’s label and retires the edge, leaving the ' +
        'version itself intact',
      count: versions,
    });
  }
  return { findings, checksRun: 2 };
};

// ─── Runner ──────────────────────────────────────────────────────────────────

/**
 * How many rows are actually here, and how many tables hold any.
 *
 * Every check below counts rows that BREAK a rule, so an empty database breaks
 * none of them and passes all 220 — the most dangerous possible result, because
 * it looks exactly like a perfect load. That is the same failure the ETL itself
 * shipped twice: a wrong Neo4j label matched nothing and reconciled `0 == 0 ✓`,
 * and a run booted against the empty target loaded nothing and declared success.
 *
 * So the total is measured up front, printed as part of the verdict, and a
 * database with no rows at all is refused rather than certified.
 */
const census = async (db: DrizzleDb) => {
  let rows = 0;
  let populated = 0;
  for (const table of TABLES.values()) {
    const count = await runCount(
      db,
      sql`select count(*)::int as n from ${from(table, 'c')}`,
    );
    rows += count;
    if (count > 0) populated++;
  }
  return { rows, populated, tables: TABLES.size };
};

export const runCutoverVerify = async (
  db: DrizzleDb,
  log: (msg: string) => void,
): Promise<VerifyReport> => {
  assertEveryUnenforcedColumnIsClassified();

  const counted = await census(db);
  log(
    `  ${counted.rows.toLocaleString()} row(s) across ${counted.populated} of ` +
      `${counted.tables} tables\n`,
  );
  if (counted.rows === 0) {
    throw new Error(
      'Refusing to verify: this database holds no rows at all. Every check ' +
        'here counts rows that break a rule, so an empty database passes all ' +
        'of them — point this at a loaded target, not a freshly migrated one.',
    );
  }

  const violations: Finding[] = [];
  const watchlist: Finding[] = [];
  let checksRun = 0;

  const groups = [
    ['unenforced references', checkUnenforcedReferences, violations],
    ['soft-deleted targets', checkDeadTargets, violations],
    ['subtype agreement', checkSubtypeAgreement, violations],
    ['array hygiene', checkArrays, violations],
    ['timestamp ordering', checkTimestampOrder, watchlist],
    ['unreachable file nodes', checkOrphanFileNodes, watchlist],
  ] as const;

  for (const [name, run, into] of groups) {
    const result = await run(db);
    checksRun += result.checksRun;
    into.push(...result.findings);
    log(
      `  ${result.findings.length === 0 ? '✓' : '·'} ${name}: ` +
        `${result.checksRun} check(s), ${result.findings.length} finding(s)`,
    );
  }

  return {
    violations,
    watchlist,
    checksRun,
    rowsChecked: counted.rows,
    clean: violations.length === 0,
  };
};
