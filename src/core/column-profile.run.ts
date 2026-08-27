/**
 * Column profiles — whole-population read parity between Neo4j and Postgres
 * (cutover-only tooling; readiness plan item A3).
 *
 * The shadow-diff compares a handful of sampled rows DEEPLY; this compares
 * every row SHALLOWLY: per column, both engines compute row count, blank
 * count, and a per-kind aggregate (true/false counts, sum/min/max, distinct
 * count) over the ENTIRE population. A 5-row sample can never catch a
 * 1,560-row systematic drift; a population profile catches it immediately.
 * This is the check that would have caught the stepChangedAt derivation, the
 * ceremonies.planned invention, and the timezone shift internally — each was
 * instead found from outside, because nothing compared all rows at once.
 *
 * Tolerance is self-calibrating, not configured: the row-count delta between
 * the engines (Neo4j label count vs Postgres table count) bounds how much any
 * COUNT metric may differ before it is flagged — dropped/unhydrated rows
 * explain up to that many, never more. Value metrics (sums, min/max) are
 * strict when the row counts agree and report-only when they differ, because
 * a sum cannot be bounded without knowing the dropped rows' values.
 *
 * Reads only. Never writes to either store.
 *
 *   DATABASE=neo4j NEO4J_URL=bolt://... POSTGRES_URL=postgresql://.../cord_shadow_r4 \
 *     yarn start --entryFile core/column-profile.run
 *
 * Exits 1 when any metric is FLAGGED (differs beyond what row losses explain).
 */
import { NestFactory } from '@nestjs/core';
import { exit } from 'node:process';
import '../polyfills';

/** One profiled column: where it lives on each engine and how to aggregate. */
interface ColumnSpec {
  /** Postgres table + column. */
  readonly table: string;
  readonly column: string;
  /** Neo4j label; the property rel defaults to the camelCase column name. */
  readonly label: string;
  readonly rel?: string;
  /**
   * Read the value straight off the node (`n.foo`) instead of walking a
   * Property edge. Some labels store values intrinsically — ProgressSummary
   * keeps planned/actual on the node, StepProgress keeps `step` there — and
   * the Property-edge pattern reads every one of those as null.
   */
  readonly intrinsic?: boolean;
  readonly kind: 'bool' | 'number' | 'date' | 'text';
  /** Extra Postgres predicate (raw SQL, ANDed with the liveness check). */
  readonly pgWhere?: string;
  /** Tables without deleted_at (real-delete or child tables) skip liveness. */
  readonly pgNoSoftDelete?: boolean;
  /**
   * Full custom Cypher for cases where "MATCH (n:Label)" is not the right
   * population — e.g. step_progress, where Postgres only holds steps whose
   * progress row landed, so the Neo4j side must walk the same liveness chain
   * the extractor did. Must RETURN the same aliases the generated query does:
   * rows, nulls, m1, m2, m3.
   */
  readonly neoCypher?: string;
  /**
   * The accepted-differences register, inline. A column that is KNOWN to
   * differ — by a signed decision, never by inertia — carries the reason
   * here; its flags downgrade to `accepted` and stop failing the run.
   * Without this the checker exits red forever and its green means nothing.
   */
  readonly accepted?: string;
}

/**
 * The v1 column set, risk-first: the columns where this month's defects lived
 * (booleans that were invented, dates that shifted), money, and the biggest
 * numeric populations. Widen freely — one line per column.
 */
const COLUMNS: readonly ColumnSpec[] = [
  // The DOMO class: booleans that used to be invented, blank since 0042.
  { table: 'ceremonies', column: 'planned', label: 'Ceremony', kind: 'bool' },
  {
    table: 'ceremonies',
    column: 'estimated_date',
    label: 'Ceremony',
    rel: 'estimatedDate',
    kind: 'date',
  },
  {
    table: 'ceremonies',
    column: 'actual_date',
    label: 'Ceremony',
    rel: 'actualDate',
    kind: 'date',
  },
  {
    table: 'engagements',
    column: 'marketable',
    label: 'Engagement',
    kind: 'bool',
  },
  {
    table: 'engagements',
    column: 'start_date_override',
    label: 'Engagement',
    rel: 'startDateOverride',
    kind: 'date',
  },
  {
    table: 'engagements',
    column: 'end_date_override',
    label: 'Engagement',
    rel: 'endDateOverride',
    kind: 'date',
  },
  {
    table: 'engagements',
    column: 'complete_date',
    label: 'Engagement',
    rel: 'completeDate',
    kind: 'date',
  },
  {
    table: 'projects',
    column: 'preset_inventory',
    label: 'Project',
    rel: 'presetInventory',
    kind: 'bool',
    accepted:
      'One source row (ZBTs8pD2lPx) carries TWO active values, TRUE then ' +
      'FALSE 357ms apart — a 2023 write failed to retire the old property. ' +
      'The load stored the newest (FALSE); Neo4j reads are a coin flip. ' +
      'Postgres is the deliberate one. Found + decided 2026-08-27.',
  },
  {
    table: 'projects',
    column: 'mou_start',
    label: 'Project',
    rel: 'mouStart',
    kind: 'date',
  },
  {
    table: 'projects',
    column: 'mou_end',
    label: 'Project',
    rel: 'mouEnd',
    kind: 'date',
  },
  {
    table: 'projects',
    column: 'estimated_submission',
    label: 'Project',
    rel: 'estimatedSubmission',
    kind: 'date',
  },
  { table: 'projects', column: 'step', label: 'Project', kind: 'text' },
  {
    table: 'projects',
    column: 'department_id',
    label: 'Project',
    rel: 'departmentId',
    kind: 'text',
  },
  { table: 'users', column: 'status', label: 'User', kind: 'text' },
  { table: 'users', column: 'timezone', label: 'User', kind: 'text' },
  { table: 'partners', column: 'active', label: 'Partner', kind: 'bool' },
  {
    table: 'partners',
    column: 'global_innovations_client',
    label: 'Partner',
    rel: 'globalInnovationsClient',
    kind: 'bool',
  },
  {
    table: 'partners',
    column: 'pmc_entity_code',
    label: 'Partner',
    rel: 'pmcEntityCode',
    kind: 'text',
  },
  {
    table: 'languages',
    column: 'is_dialect',
    label: 'Language',
    rel: 'isDialect',
    kind: 'bool',
  },
  {
    table: 'languages',
    column: 'least_of_these',
    label: 'Language',
    rel: 'leastOfThese',
    kind: 'bool',
  },
  {
    table: 'languages',
    column: 'is_sign_language',
    label: 'Language',
    rel: 'isSignLanguage',
    kind: 'bool',
  },
  {
    table: 'languages',
    column: 'sensitivity',
    label: 'Language',
    kind: 'text',
  },
  {
    table: 'languages',
    column: 'population_override',
    label: 'Language',
    rel: 'populationOverride',
    kind: 'number',
  },
  // Products: the invented-denominator family + verse totals.
  {
    table: 'products',
    column: 'progress_target',
    label: 'Product',
    rel: 'progressTarget',
    kind: 'number',
    accepted:
      "The loader deliberately fills blank targets with 100 — Rob's call " +
      '2026-08-26: every blank is on a Percent-measured product where 100 ' +
      'is the documented value. Neo4j nulls ~12,081, Postgres 0, by design.',
  },
  {
    table: 'products',
    column: 'total_verses',
    label: 'Product',
    rel: 'totalVerses',
    kind: 'number',
  },
  {
    table: 'products',
    column: 'total_verse_equivalents',
    label: 'Product',
    rel: 'totalVerseEquivalents',
    kind: 'number',
  },
  { table: 'products', column: 'methodology', label: 'Product', kind: 'text' },
  // Money. 18,648 rows nobody had ever compared before this file existed.
  {
    table: 'budget_records',
    column: 'amount',
    label: 'BudgetRecord',
    kind: 'number',
  },
  {
    table: 'budget_records',
    column: 'fiscal_year',
    label: 'BudgetRecord',
    rel: 'fiscalYear',
    kind: 'number',
  },
  // Progress numbers — the sums reports are built from. Stored ON the node in
  // Neo4j (the extractor reads `summary.planned`), not as Property edges.
  {
    table: 'progress_summaries',
    column: 'planned',
    label: 'ProgressSummary',
    kind: 'number',
    intrinsic: true,
    pgNoSoftDelete: true,
  },
  {
    table: 'progress_summaries',
    column: 'actual',
    label: 'ProgressSummary',
    kind: 'number',
    intrinsic: true,
    pgNoSoftDelete: true,
  },
  // The giant: 1.48M step rows. Postgres only holds steps whose progress row
  // landed (live product AND live report), so the Neo4j side walks the same
  // chain the extractor did rather than counting the bare label — the bare
  // label includes ~82K steps under soft-deleted parents that are correct to
  // exclude.
  {
    table: 'step_progress',
    column: 'completed',
    label: 'StepProgress',
    kind: 'number',
    pgNoSoftDelete: true,
    // Edge names verified against product-progress.extractor.ts: BOTH the
    // product and the report point INTO the ProductProgress node via edges
    // named `progress`; `completed` is a Property edge on the step.
    neoCypher: `
      MATCH (:Product)-[:progress { active: true }]->(pp:ProductProgress)
              <-[:progress { active: true }]-(:PeriodicReport),
            (pp)-[:step { active: true }]->(sp:StepProgress)
      OPTIONAL MATCH (sp)-[:completed { active: true }]->(p:Property)
      WITH sp, collect(p.value)[0] AS v
      RETURN count(sp) AS rows,
             sum(CASE WHEN v IS NULL THEN 1 ELSE 0 END) AS nulls,
             round(sum(CASE WHEN v IS NULL THEN 0.0 ELSE v END) * 100) / 100 AS m1,
             min(v) AS m2,
             max(v) AS m3
    `,
  },
];

/** Per-kind metric names, for the report header and the comparison rules. */
const METRIC_NAMES: Record<
  ColumnSpec['kind'],
  readonly [string, string, string]
> = {
  bool: ['true', 'false', '—'],
  number: ['sum', 'min', 'max'],
  date: ['min', 'max', '—'],
  text: ['distinct', '—', '—'],
};

interface Profile {
  readonly rows: number;
  readonly nulls: number;
  readonly m1: unknown;
  readonly m2: unknown;
  readonly m3: unknown;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));

/** Build the generated Cypher for a spec (used unless neoCypher overrides). */
const cypherFor = (spec: ColumnSpec): string => {
  const rel = spec.rel ?? spec.column;
  // collect(p.value)[0] folds duplicate ACTIVE property edges (the file-domain
  // fan-out taught us they exist) to one value per node instead of letting a
  // duplicate edge double-count an aggregate.
  const metrics = {
    bool: `sum(CASE WHEN v = true THEN 1 ELSE 0 END) AS m1,
           sum(CASE WHEN v = false THEN 1 ELSE 0 END) AS m2,
           0 AS m3`,
    number: `round(sum(CASE WHEN v IS NULL THEN 0.0 ELSE v END) * 100) / 100 AS m1,
             min(v) AS m2,
             max(v) AS m3`,
    date: `min(toString(v)) AS m1, max(toString(v)) AS m2, 0 AS m3`,
    text: `count(DISTINCT v) AS m1, 0 AS m2, 0 AS m3`,
  }[spec.kind];
  const value = spec.intrinsic
    ? `MATCH (n:${spec.label})
       WITH n, n.${rel} AS v`
    : `MATCH (n:${spec.label})
       OPTIONAL MATCH (n)-[:${rel} { active: true }]->(p:Property)
       WITH n, collect(p.value)[0] AS v`;
  return `
    ${value}
    RETURN count(n) AS rows,
           sum(CASE WHEN v IS NULL THEN 1 ELSE 0 END) AS nulls,
           ${metrics}
  `;
};

/** Build the Postgres SQL for a spec. */
const sqlFor = (spec: ColumnSpec): string => {
  const col = `"${spec.column}"`;
  const live = spec.pgNoSoftDelete ? 'true' : '"deleted_at" is null';
  const where = spec.pgWhere ? `${live} and (${spec.pgWhere})` : live;
  const metrics = {
    bool: `count(*) filter (where ${col} = true) as m1,
           count(*) filter (where ${col} = false) as m2, 0 as m3`,
    number: `coalesce(round(sum(${col})::numeric, 2), 0) as m1,
             min(${col}) as m2, max(${col}) as m3`,
    date: `min(${col})::text as m1, max(${col})::text as m2, 0 as m3`,
    text: `count(distinct ${col}) as m1, 0 as m2, 0 as m3`,
  }[spec.kind];
  return `
    select count(*)::int as rows,
           count(*) filter (where ${col} is null)::int as nulls,
           ${metrics}
      from "${spec.table}" where ${where}
  `;
};

type Status = 'match' | 'explained' | 'report' | 'accepted' | 'FLAG';
interface MetricResult {
  readonly metric: string;
  readonly status: Status;
  readonly neo: unknown;
  readonly pg: unknown;
}

interface Verdict {
  readonly spec: ColumnSpec;
  readonly neo: Profile;
  readonly pg: Profile;
  readonly rowDelta: number;
  readonly metrics: readonly MetricResult[];
}

const compare = (spec: ColumnSpec, neo: Profile, pg: Profile): Verdict => {
  const rowDelta = Math.abs(num(neo.rows) - num(pg.rows));
  const metrics: MetricResult[] = [];

  const judgeCount = (metric: string, a: number, b: number) => {
    const d = Math.abs(a - b);
    metrics.push({
      metric,
      status:
        d === 0
          ? 'match'
          : d <= rowDelta
            ? 'explained'
            : spec.accepted
              ? 'accepted'
              : 'FLAG',
      neo: a,
      pg: b,
    });
  };
  const judgeValue = (metric: string, a: unknown, b: unknown) => {
    // Numeric-aware: Postgres numerics arrive as strings ('2971791934.00')
    // while Neo4j returns numbers — same value, two costumes. Both engines
    // round sums to 2dp, so half a cent of float drift is tolerated.
    const [na, nb] = [Number(a), Number(b)];
    const same =
      a != null && b != null && Number.isFinite(na) && Number.isFinite(nb)
        ? Math.abs(na - nb) < 0.005
        : String(a ?? '') === String(b ?? '');
    metrics.push({
      metric,
      status: same
        ? 'match'
        : rowDelta !== 0
          ? 'report'
          : spec.accepted
            ? 'accepted'
            : 'FLAG',
      neo: a,
      pg: b,
    });
  };

  judgeCount('nulls', num(neo.nulls), num(pg.nulls));
  const [n1, n2] = METRIC_NAMES[spec.kind];
  if (spec.kind === 'bool') {
    judgeCount(n1, num(neo.m1), num(pg.m1));
    judgeCount(n2, num(neo.m2), num(pg.m2));
  } else if (spec.kind === 'text') {
    judgeCount(n1, num(neo.m1), num(pg.m1));
  } else {
    // number / date: sums and extremes are value metrics.
    judgeValue(n1, neo.m1, pg.m1);
    judgeValue(n2, neo.m2, pg.m2);
    if (spec.kind === 'number') judgeValue('max', neo.m3, pg.m3);
  }
  return { spec, neo, pg, rowDelta, metrics };
};

async function bootstrap() {
  process.argv.push('console');
  // Profiling must not write to either store — booting the AppModule does,
  // unless these are off. Same reasoning and wording as shadow-diff.run.ts.
  process.env.DB_ROOT_OBJECTS_SYNC = 'false';
  process.env.DB_CREATE_INDEXES = 'false';

  const { AppModule } = await import('../app.module');
  const { ConfigService } = await import('~/core/config');
  const { DrizzleService } = await import('~/core/drizzle/drizzle.service');
  const { DatabaseService } = await import('~/core/neo4j');
  const { sql } = await import('drizzle-orm');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  // eslint-disable-next-line no-console
  const log = (msg: string) => console.log(msg);
  let flagged = 0;
  try {
    await app.init();
    const config = app.get(ConfigService);
    const drizzle = app.get(DrizzleService);
    const neo4j = app.get(DatabaseService);

    if (config.databaseEngine !== 'neo4j') {
      // splitDb is irrelevant here (raw queries only), but requiring the same
      // invocation as the other cutover tools keeps the runbook uniform.
      throw new Error(
        `DATABASE must be neo4j (got '${config.databaseEngine}').`,
      );
    }
    if (!config.postgres.url) {
      throw new Error('POSTGRES_URL is required (the Postgres side).');
    }
    log(
      `\nColumn profiles — Neo4j vs Postgres ` +
        `${new URL(config.postgres.url).pathname}` +
        `\n${COLUMNS.length} columns, whole population, both engines\n`,
    );

    const verdicts: Verdict[] = [];
    for (const spec of COLUMNS) {
      const neoRows = await neo4j
        .query<Profile>(spec.neoCypher ?? cypherFor(spec))
        .run();
      const pgResult = await drizzle.client.execute(sql.raw(sqlFor(spec)));
      const pgRows = pgResult.rows as unknown as Profile[];
      const neoProfile = neoRows[0];
      const pgProfile = pgRows[0];
      if (!neoProfile || !pgProfile) {
        // Aggregate queries always return one row; an empty result means the
        // query itself failed to parse or the label/table does not exist.
        throw new Error(
          `Profile query returned no row for ${spec.table}.${spec.column}`,
        );
      }
      verdicts.push(compare(spec, neoProfile, pgProfile));
    }

    // Report — one line per column; a detail line per non-matching metric.
    for (const v of verdicts) {
      const name = `${v.spec.table}.${v.spec.column}`;
      const worst = v.metrics.some((m) => m.status === 'FLAG')
        ? '✗ FLAG'
        : v.metrics.some((m) => m.status === 'accepted')
          ? '§ accepted'
          : v.metrics.some((m) => m.status === 'report')
            ? '≈ report'
            : v.metrics.some((m) => m.status === 'explained')
              ? '~ explained'
              : '✓';
      log(
        `${worst.padEnd(11)} ${name.padEnd(42)} rows ${String(num(v.neo.rows)).padStart(8)} → ${String(num(v.pg.rows)).padStart(8)}` +
          (v.rowDelta > 0 ? `  (Δ${v.rowDelta})` : ''),
      );
      for (const m of v.metrics) {
        if (m.status === 'match') continue;
        log(
          `             ${m.status.padEnd(9)} ${m.metric.padEnd(9)} ` +
            `neo4j ${String(m.neo)} | postgres ${String(m.pg)}`,
        );
        if (m.status === 'FLAG') flagged += 1;
      }
      if (v.spec.accepted && v.metrics.some((m) => m.status === 'accepted')) {
        log(`             § ${v.spec.accepted}`);
      }
    }

    const explained = verdicts.filter((v) =>
      v.metrics.some((m) => m.status === 'explained'),
    ).length;
    const reports = verdicts.filter((v) =>
      v.metrics.some((m) => m.status === 'report'),
    ).length;
    const accepted = verdicts.filter((v) =>
      v.metrics.some((m) => m.status === 'accepted'),
    ).length;
    log(
      `\n${COLUMNS.length} columns profiled — ` +
        `${flagged} FLAGGED metric(s), ` +
        `${accepted} column(s) differing by signed acceptance, ` +
        `${explained} column(s) with count deltas within row losses, ` +
        `${reports} column(s) with value metrics reported under differing row counts.`,
    );
    if (flagged > 0) {
      log(
        'FLAG = the metric differs by MORE than the row-count delta can explain.' +
          '\nEither a real read divergence or a load defect — investigate before trusting reads.',
      );
    }
  } finally {
    await app.close();
  }
  exit(flagged > 0 ? 1 : 0);
}

bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  exit(1);
});
