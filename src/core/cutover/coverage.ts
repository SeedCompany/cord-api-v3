import { sql } from 'drizzle-orm';
import { type DrizzleDb } from '~/core/drizzle/drizzle.service';
import { type DatabaseService } from '~/core/neo4j';
import {
  type Disposition,
  labels as labelManifest,
  propertyKeys as propertyKeyManifest,
  relationshipTypes as relationshipTypeManifest,
} from './coverage-manifest';

/**
 * Cutover coverage check — the SOURCE enumerates itself, and everything it
 * names must be claimed in coverage-manifest.ts. See that file's header for the
 * why; this file is the mechanics.
 *
 * Three checks, all fail-closed:
 *
 * 1. **Claims.** `db.labels()`, `db.relationshipTypes()` and `db.propertyKeys()`
 *    are compared against the manifest. Anything unlisted is a violation — and
 *    so is anything listed as `review`, because an unanswered question is not a
 *    default to excluded.
 * 2. **Counts, from the source's side.** For every `migrated` label naming a
 *    table, the SOURCE node count (via Neo4j's count store, so this is O(1) per
 *    label, not a scan) must equal the Postgres row count plus the entry's
 *    written-down shortfall. This is independent of the ETL's own
 *    reconciliation, which only ever compares the ETL's two numbers.
 * 3. **Census.** A source that enumerates nothing, or a target with no rows,
 *    fails outright rather than passing everything vacuously — the same guard
 *    `cutover-verify` carries, for the same reason: every check here counts
 *    problems, and an empty database has none.
 *
 * ## Two Cypher traps this file works around, both hit while building it
 *
 * - `RETURN 'X' AS name, count(n)` makes the constant a GROUPING key, so a
 *   label with zero nodes yields ZERO ROWS, not a zero count — ten labels
 *   silently vanished from the first count query. Aggregate first
 *   (`WITH count(n) AS n`), then attach the constant.
 * - Counting by re-matching each label over the graph
 *   (`WHERE label IN labels(n)`) scans 22M nodes per label and times out.
 *   One `UNION ALL` of per-label `MATCH (n:X)` counts hits the count store.
 */

export interface CoverageFinding {
  readonly axis: 'label' | 'relationship type' | 'property key';
  readonly name: string;
  readonly detail: string;
  /** Source occurrences, where the axis has a cheap count (labels, rel types). */
  readonly count?: number;
}

export interface LabelCountRow {
  readonly label: string;
  readonly sourceCount: number;
  /** The disposition kind, or 'live-only rule' for rule-claimed Deleted_* labels. */
  readonly kind: string;
  /** For counted labels: source − shortfall (+ plusLabels), what Postgres must hold. */
  readonly expected?: number;
  readonly actual?: number;
  readonly ok?: boolean;
}

export interface CoverageReport {
  /** Names the source enumerates that the manifest does not claim. Violations. */
  readonly unclaimed: readonly CoverageFinding[];
  /** Open `review` questions present in this source. Violations until answered. */
  readonly reviews: readonly CoverageFinding[];
  /** Counted labels whose source-vs-target gap is not the written-down one. */
  readonly countMismatches: readonly CoverageFinding[];
  /** Every label with its source count and how it is claimed — the full ledger. */
  readonly labelRows: readonly LabelCountRow[];
  /** Manifest names this source does not enumerate (fine — informational). */
  readonly staleManifest: readonly string[];
  /** Sum over per-label counts. Multi-label nodes count once per label; census only. */
  readonly sourceLabeledNodes: number;
  /** Sum over the counted Postgres tables. */
  readonly targetRows: number;
  /** Claim sweeps (one per name) + count comparisons. */
  readonly checksRun: number;
  readonly clean: boolean;
}

/** Structural slice of DatabaseService this check needs — a raw Cypher read. */
type SourceGraph = Pick<DatabaseService, 'query'>;

const enumerate = async (
  neo4j: SourceGraph,
  procedure: string,
  column: string,
): Promise<string[]> => {
  const rows = await neo4j
    .query<
      Record<string, string>
    >(`CALL ${procedure}() YIELD ${column} RETURN ${column}`)
    .run();
  return rows.map((row) => row[column]!);
};

/**
 * Only plain identifier names may be interpolated into the generated count
 * query. Nothing in either database mints names outside this set; refusing here
 * beats discovering what a backtick in a label does to a UNION of 199 queries.
 */
const assertPlainName = (name: string) => {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(
      `Coverage: the source enumerated a name this check refuses to ` +
        `interpolate into a query: "${name}"`,
    );
  }
};

/** Count-store counts for every label, one query. See the header for the traps. */
const countLabels = async (
  neo4j: SourceGraph,
  labels: readonly string[],
): Promise<ReadonlyMap<string, number>> => {
  if (labels.length === 0) return new Map();
  labels.forEach(assertPlainName);
  const union = labels
    .map(
      (label) =>
        `MATCH (n:\`${label}\`) WITH count(n) AS n RETURN '${label}' AS name, n`,
    )
    .join(' UNION ALL ');
  const rows = await neo4j.query<{ name: string; n: number }>(union).run();
  return new Map(rows.map((row) => [row.name, Number(row.n)]));
};

/** Count-store counts for every relationship type, one query. */
const countRelationshipTypes = async (
  neo4j: SourceGraph,
  types: readonly string[],
): Promise<ReadonlyMap<string, number>> => {
  if (types.length === 0) return new Map();
  types.forEach(assertPlainName);
  const union = types
    .map(
      (type) =>
        `MATCH ()-[r:\`${type}\`]->() WITH count(r) AS n RETURN '${type}' AS name, n`,
    )
    .join(' UNION ALL ');
  const rows = await neo4j.query<{ name: string; n: number }>(union).run();
  return new Map(rows.map((row) => [row.name, Number(row.n)]));
};

const pgCount = async (
  db: DrizzleDb,
  table: string,
  where?: string,
): Promise<number> => {
  if (!/^[a-z0-9_]+$/.test(table)) {
    throw new Error(
      `Coverage: refusing to count a non-identifier table "${table}"`,
    );
  }
  const result = await db.execute<{ n: number }>(
    sql.raw(
      `SELECT count(*)::int AS n FROM "${table}"${where ? ` WHERE ${where}` : ''}`,
    ),
  );
  return Number(result.rows[0]?.n ?? 0);
};

/**
 * The live-only rule for soft-deleted labels. Neo4j soft-delete PREFIXES labels
 * (and stacks: `Deleted_Deleted_Property`), so match the prefix at any depth —
 * the same depth-proofing lesson as the scrub's `isFieldRecord`. The rule only
 * claims a label whose fully-stripped BASE is itself in the manifest; a
 * `Deleted_` label over an unknown base stays unclaimed and fails the run.
 */
const stripDeleted = (label: string) => label.replace(/^(?:Deleted_)+/, '');

const resolveLabelClaim = (
  label: string,
): { disposition: Disposition; kind: string } | null => {
  const explicit = labelManifest[label];
  if (explicit) return { disposition: explicit, kind: explicit.kind };
  if (label.startsWith('Deleted_') && labelManifest[stripDeleted(label)]) {
    return {
      disposition: {
        kind: 'excluded',
        reason: `soft-deleted ${stripDeleted(label)} — the ETL is live-only`,
      },
      kind: 'live-only rule',
    };
  }
  return null;
};

export const runCutoverCoverage = async (
  neo4j: SourceGraph,
  db: DrizzleDb,
  log: (msg: string) => void,
): Promise<CoverageReport> => {
  const [sourceLabels, sourceRelTypes, sourcePropertyKeys] = await Promise.all([
    enumerate(neo4j, 'db.labels', 'label'),
    enumerate(neo4j, 'db.relationshipTypes', 'relationshipType'),
    enumerate(neo4j, 'db.propertyKeys', 'propertyKey'),
  ]);
  log(
    `Source enumerates ${sourceLabels.length} labels, ` +
      `${sourceRelTypes.length} relationship types, ` +
      `${sourcePropertyKeys.length} property keys.`,
  );
  if (sourceLabels.length === 0 || sourceRelTypes.length === 0) {
    // An empty enumeration means the wrong (or an empty) graph, and every claim
    // below would pass over nothing. That must never read as coverage.
    throw new Error(
      'Coverage refused: the source graph enumerates no labels or no ' +
        'relationship types — this is not a database with data to account for.',
    );
  }

  const labelCounts = await countLabels(neo4j, sourceLabels);
  const relTypeCounts = await countRelationshipTypes(neo4j, sourceRelTypes);
  const sourceLabeledNodes = [...labelCounts.values()].reduce(
    (sum, n) => sum + n,
    0,
  );
  if (sourceLabeledNodes === 0) {
    throw new Error(
      'Coverage refused: every label counts zero nodes — an empty source ' +
        'trivially satisfies every claim, which must never read as coverage.',
    );
  }

  const unclaimed: CoverageFinding[] = [];
  const reviews: CoverageFinding[] = [];
  const countMismatches: CoverageFinding[] = [];
  const labelRows: LabelCountRow[] = [];
  let checksRun = 0;
  let targetRows = 0;

  // ── Axis 1: labels — claims and counts ─────────────────────────────────────
  for (const label of [...sourceLabels].sort((a, b) => a.localeCompare(b))) {
    checksRun++;
    const sourceCount = labelCounts.get(label) ?? 0;
    const claim = resolveLabelClaim(label);
    if (!claim) {
      unclaimed.push({
        axis: 'label',
        name: label,
        count: sourceCount,
        detail: `${sourceCount} node(s) with no disposition — nobody has decided what happens to these`,
      });
      labelRows.push({ label, sourceCount, kind: 'UNCLAIMED' });
      continue;
    }
    const { disposition } = claim;
    if (disposition.kind === 'review') {
      reviews.push({
        axis: 'label',
        name: label,
        count: sourceCount,
        detail: disposition.question,
      });
      labelRows.push({ label, sourceCount, kind: 'review' });
      continue;
    }

    if (disposition.kind === 'migrated' && disposition.table) {
      checksRun++;
      const plus = (disposition.plusLabels ?? []).reduce(
        (sum, other) => sum + (labelCounts.get(other) ?? 0),
        0,
      );
      const shortfall = (disposition.shortfall ?? []).reduce(
        (sum, entry) => sum + entry.count,
        0,
      );
      const expected = sourceCount + plus - shortfall;
      const actual = await pgCount(db, disposition.table, disposition.where);
      targetRows += actual;
      const ok = actual === expected;
      if (!ok) {
        const target =
          disposition.table +
          (disposition.where ? ` WHERE ${disposition.where}` : '');
        countMismatches.push({
          axis: 'label',
          name: label,
          count: sourceCount,
          detail:
            `source ${sourceCount}${plus ? ` (+${plus} via ${disposition.plusLabels!.join('+')})` : ''}` +
            ` − ${shortfall} explained = ${expected} expected, but ${target} holds ${actual} ` +
            `(off by ${actual - expected}). Either rows were lost without a written-down reason, ` +
            `or a recorded shortfall no longer matches this snapshot — re-verify its cause ` +
            `before touching the number`,
        });
      }
      labelRows.push({
        label,
        sourceCount,
        kind: claim.kind,
        expected,
        actual,
        ok,
      });
      continue;
    }

    labelRows.push({ label, sourceCount, kind: claim.kind });
  }

  // ── Axis 2: relationship types — claims ────────────────────────────────────
  for (const type of [...sourceRelTypes].sort((a, b) => a.localeCompare(b))) {
    checksRun++;
    const count = relTypeCounts.get(type) ?? 0;
    const disposition = relationshipTypeManifest[type];
    if (!disposition) {
      unclaimed.push({
        axis: 'relationship type',
        name: type,
        count,
        detail: `${count} edge(s) with no disposition — a connection or stored field nobody has accounted for`,
      });
      continue;
    }
    if (disposition.kind === 'review') {
      reviews.push({
        axis: 'relationship type',
        name: type,
        count,
        detail: disposition.question,
      });
    }
  }

  // ── Axis 3: property keys — claims ─────────────────────────────────────────
  // The highest-value axis: a key nobody claims is a FIELD that arrives empty
  // while every row count still reconciles. No cheap per-key count exists
  // (the count store does not cover properties), so this axis is claims-only —
  // which is why every `excluded` entry in the manifest cites a measured probe.
  for (const key of [...sourcePropertyKeys].sort((a, b) =>
    a.localeCompare(b),
  )) {
    checksRun++;
    const disposition = propertyKeyManifest[key];
    if (!disposition) {
      unclaimed.push({
        axis: 'property key',
        name: key,
        detail:
          'no disposition — if any extractor misses this field, every row still arrives and a ' +
          'column is silently empty. Probe what carries it before classifying',
      });
      continue;
    }
    if (disposition.kind === 'review') {
      reviews.push({
        axis: 'property key',
        name: key,
        detail: disposition.question,
      });
    }
  }

  if (targetRows === 0) {
    throw new Error(
      'Coverage refused: the counted Postgres tables hold zero rows — this is ' +
        'not a loaded database, and nothing meaningful was compared.',
    );
  }

  // Manifest entries this source does not enumerate. Not a violation — the
  // manifest may know more than one snapshot (scrub markers exist only on
  // copies; retired names disappear once their token store is rebuilt).
  const sourceNames = {
    labels: new Set(sourceLabels),
    relationshipTypes: new Set(sourceRelTypes),
    propertyKeys: new Set(sourcePropertyKeys),
  };
  const staleManifest = [
    ...Object.keys(labelManifest)
      .filter((name) => !sourceNames.labels.has(name))
      .map((name) => `label ${name}`),
    ...Object.keys(relationshipTypeManifest)
      .filter((name) => !sourceNames.relationshipTypes.has(name))
      .map((name) => `relationship type ${name}`),
    ...Object.keys(propertyKeyManifest)
      .filter((name) => !sourceNames.propertyKeys.has(name))
      .map((name) => `property key ${name}`),
  ];

  return {
    unclaimed,
    reviews,
    countMismatches,
    labelRows,
    staleManifest,
    sourceLabeledNodes,
    targetRows,
    checksRun,
    clean:
      unclaimed.length === 0 &&
      reviews.length === 0 &&
      countMismatches.length === 0,
  };
};
