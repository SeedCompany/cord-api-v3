import { sql } from 'drizzle-orm';
import { checkScrubGate } from '../scrub/provenance';
import {
  type CutoverContext,
  type Extractor,
  type TableStat,
} from './cutover.types';

/**
 * Topologically order extractors by their `dependsOn` (parents before
 * children). Throws on an unknown dependency or a cycle.
 */
const orderExtractors = (extractors: readonly Extractor[]): Extractor[] => {
  const byName = new Map(extractors.map((e) => [e.name, e]));
  const ordered: Extractor[] = [];
  const state = new Map<string, 'visiting' | 'done'>();

  const visit = (e: Extractor) => {
    const s = state.get(e.name);
    if (s === 'done') return;
    if (s === 'visiting') {
      throw new Error(`Cutover: dependency cycle involving "${e.name}"`);
    }
    state.set(e.name, 'visiting');
    for (const dep of e.dependsOn ?? []) {
      const depE = byName.get(dep);
      if (!depE) {
        throw new Error(`Cutover: "${e.name}" depends on unknown "${dep}"`);
      }
      visit(depE);
    }
    state.set(e.name, 'done');
    ordered.push(e);
  };

  for (const e of extractors) visit(e);
  return ordered;
};

/** `SELECT count(*)` for a Postgres table. */
const pgCount = async (ctx: CutoverContext, table: string): Promise<number> => {
  const res = await ctx.db.execute<{ n: number }>(
    sql.raw(`SELECT count(*)::int AS n FROM "${table}"`),
  );
  return res.rows[0]?.n ?? 0;
};

/**
 * Run the cutover ETL.
 *
 * 1. Order extractors by dependency.
 * 2. (unless dry-run) TRUNCATE every target table up front — CASCADE + reverse
 *    order makes the load idempotent so dry-runs / retries start clean.
 * 3. Run each extractor.
 * 4. Reconcile: compare rows-read vs rows-inserted vs the live `count(*)`.
 */
export interface CutoverResult {
  /** False when a table's inserted count disagreed with its live `count(*)`. */
  allOk: boolean;
  totalDropped: number;
  totalNotHydrated: number;
  totalLost: number;
}

export const runCutover = async (
  ctx: CutoverContext,
  extractors: readonly Extractor[],
  opts: { only?: readonly string[] } = {},
): Promise<CutoverResult> => {
  // Scrub gate, checked here rather than at the entry point because THIS is the
  // thing that reads the graph in bulk and persists what it reads. An entry-point
  // check is bypassed by any other caller; this one is not.
  //
  // Allows a small unmarked graph through (local test data) and refuses a
  // production-scale one that carries no scrub marker. See scrub/provenance.ts.
  const gate = await checkScrubGate(ctx.neo4j);
  if (!gate.allowed && !ctx.allowProductionSource) {
    throw new Error(`Cutover refused — ${gate.reason}`);
  }
  ctx.log(`Source: ${gate.reason}`);

  const ordered = orderExtractors(extractors);
  // An unknown --only name is a typo, not a request for nothing. Silently
  // running the subset that DID match is the worst outcome: `--only=user,engagment`
  // would load users, print a clean reconciliation, and never mention that the
  // domain the operator actually cared about was skipped.
  if (opts.only?.length) {
    const known = new Set(ordered.map((e) => e.name));
    const unknown = opts.only.filter((name) => !known.has(name));
    if (unknown.length > 0) {
      throw new Error(
        `Cutover: --only names no such extractor: ${unknown.join(', ')}. ` +
          `Known: ${ordered.map((e) => e.name).join(', ')}`,
      );
    }
  }
  const selected = opts.only?.length
    ? ordered.filter((e) => opts.only!.includes(e.name))
    : ordered;

  if (selected.length === 0) {
    ctx.log('Cutover: no extractors selected.');
    return {
      allOk: true,
      totalDropped: 0,
      totalNotHydrated: 0,
      totalLost: 0,
    };
  }

  ctx.log(
    `\nCutover ${ctx.dryRun ? '(DRY RUN — no writes)' : ''}\n` +
      `Domains: ${selected.map((e) => e.name).join(' → ')}\n`,
  );

  // Truncate target tables first (idempotent load). CASCADE handles FK order;
  // we truncate the full set the selected extractors own.
  if (!ctx.dryRun) {
    const tables = [...new Set(selected.flatMap((e) => e.targetTables))];
    const quoted = tables.map((t) => `"${t}"`).join(', ');
    ctx.log(`Truncating ${tables.length} target tables…`);
    await ctx.db.execute(
      sql.raw(`TRUNCATE ${quoted} RESTART IDENTITY CASCADE`),
    );
  }

  const results = new Map<string, Record<string, TableStat>>();
  for (const e of selected) {
    ctx.log(`\n▶ ${e.name}`);
    const started = process.hrtime.bigint();
    const stats = await e.run(ctx);
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    results.set(e.name, stats);
    for (const [table, s] of Object.entries(stats)) {
      ctx.log(`    ${table}: read ${s.read}, inserted ${s.inserted}`);
    }
    ctx.log(`    (${ms.toFixed(0)}ms)`);
  }

  // Reconciliation report.
  ctx.log('\n─── Reconciliation ───');
  ctx.log('  table                              read  inserted   pgCount  ok');
  let allOk = true;
  let totalDropped = 0;
  for (const e of selected) {
    for (const table of e.targetTables) {
      const s = results.get(e.name)?.[table] ?? { read: 0, inserted: 0 };
      const count = ctx.dryRun ? s.inserted : await pgCount(ctx, table);
      // TWO distinct failures, deliberately not collapsed:
      //  · inserted ≠ pgCount → a write did not land. Broken.
      //  · read ≠ inserted    → rows were DROPPED (unique conflict, guard skip).
      //    Not corrupt, but it is silent data loss and must never read as ✓.
      //    `inserted` counts what Postgres actually wrote, so it equals pgCount
      //    on a healthy run — which means the drop signal lives in read-vs-
      //    inserted and nowhere else.
      const countMatches = ctx.dryRun || count === s.inserted;
      const dropped = ctx.dryRun ? 0 : s.read - s.inserted;
      if (!countMatches) allOk = false;
      totalDropped += Math.max(0, dropped);
      const verdict = !countMatches
        ? '✗ MISMATCH'
        : dropped > 0
          ? `⚠ DROPPED ${dropped}`
          : '✓';
      ctx.log(
        `  ${table.padEnd(34)} ${String(s.read).padStart(5)} ` +
          `${String(s.inserted).padStart(9)} ${String(count).padStart(9)}  ` +
          verdict,
      );
    }
  }
  // Rows lost during hydration, which the table above cannot show: they are
  // gone before `read` counts them, so their tables tick ✓. Reported as its own
  // block, keyed by node label rather than table, because that is the only
  // thing known at the point the row disappears.
  const totalNotHydrated = [...ctx.notHydrated.values()].reduce(
    (sum, n) => sum + n,
    0,
  );
  if (totalNotHydrated > 0) {
    ctx.log(
      '\n─── Not hydrated (found in Neo4j, never reached the mapper) ───\n' +
        '  These do NOT appear in the table above — their tables read ✓.',
    );
    for (const [label, count] of ctx.notHydrated) {
      ctx.log(`  ${label.padEnd(34)} ${String(count).padStart(5)}`);
    }
  }

  const totalLost = totalDropped + totalNotHydrated;
  ctx.log(
    `\nCutover ${ctx.dryRun ? 'dry-run' : 'load'} complete — ${
      !allOk
        ? 'MISMATCHES above ✗'
        : totalLost > 0
          ? `counts reconcile, but ${totalLost} row(s) did not make it: ` +
            `${totalDropped} dropped by a guard, ${totalNotHydrated} lost while reading. ` +
            'See the ⚠ lines and the per-domain warnings above. A root-entity drop takes ' +
            'its whole subtree with it; do not treat this as a clean load.'
          : 'all tables reconciled, zero rows lost ✓'
    }`,
  );

  // Returned rather than only printed, so the caller can set an exit code. A
  // load that MISMATCHed used to end in exit 0 exactly like a clean one, which
  // makes the run unusable as an automated gate and puts the entire weight of
  // catching a broken load on someone reading scrollback.
  return { allOk, totalDropped, totalNotHydrated, totalLost };
};
