import { sql } from 'drizzle-orm';
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
export const runCutover = async (
  ctx: CutoverContext,
  extractors: readonly Extractor[],
  opts: { only?: readonly string[] } = {},
): Promise<void> => {
  const ordered = orderExtractors(extractors);
  const selected = opts.only?.length
    ? ordered.filter((e) => opts.only!.includes(e.name))
    : ordered;

  if (selected.length === 0) {
    ctx.log('Cutover: no extractors selected.');
    return;
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
  ctx.log(
    `\nCutover ${ctx.dryRun ? 'dry-run' : 'load'} complete — ${
      !allOk
        ? 'MISMATCHES above ✗'
        : totalDropped > 0
          ? `counts reconcile, but ${totalDropped} row(s) were DROPPED — see the ⚠ lines and the per-domain warnings above. ` +
            'A root-entity drop takes its whole subtree with it; do not treat this as a clean load.'
          : 'all tables reconciled, zero rows dropped ✓'
    }`,
  );
};
