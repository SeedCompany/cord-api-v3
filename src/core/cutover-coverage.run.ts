/**
 * Coverage check for the cutover ETL: the SOURCE graph enumerates itself, and
 * everything it names — every label, relationship type and property key — must
 * be claimed in cutover/coverage-manifest.ts. Exits 1 on anything unclaimed, on
 * any open `review` question, and on any source-vs-target count gap that does
 * not match a written-down shortfall.
 *
 * This is the inverse of every other cutover check: reconciliation, verify and
 * shadow-diff all enumerate from OUR lists and so can only confirm what someone
 * already thought of. This run answers the remaining question — "did we tell
 * the ETL about everything?" — from the source's side.
 *
 * Unlike cutover-verify.run (Postgres-only), this needs BOTH databases:
 *   NEO4J_URL      — the source graph (.env.local points at the prodcopy)
 *   POSTGRES_URL   — the loaded target to count against
 *
 *   POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord_cutover_verify \
 *     yarn start --entryFile core/cutover-coverage.run
 *
 * READ-ONLY BY CONSTRUCTION, same guards as cutover-verify.run and cutover.run:
 * root-object sync and index creation are writes into the SOURCE graph, and
 * under DATABASE=postgres the DrizzleMigrator would issue DDL against the
 * TARGET it is about to count — so the engine is forced to neo4j (nothing here
 * reads through a repository, so the engine has no legitimate effect), and both
 * bootstrap write paths are switched off before ConfigService reads env.
 *
 * Exit codes: 0 every name claimed and every count explained; 1 otherwise.
 */
import { NestFactory } from '@nestjs/core';
import { exit } from 'node:process';
import '../polyfills';

async function bootstrap() {
  process.argv.push('console');

  process.env.DB_ROOT_OBJECTS_SYNC = 'false';
  process.env.DB_CREATE_INDEXES = 'false';
  process.env.DATABASE = 'neo4j';

  const { AppModule } = await import('../app.module');
  const { ConfigService } = await import('~/core/config');
  const { DrizzleService } = await import('~/core/drizzle/drizzle.service');
  const { DatabaseService } = await import('~/core/neo4j');
  const { runCutoverCoverage } = await import('./cutover/coverage');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  // CLI script — its output IS the interface. Same as cutover-verify.run.ts.
  // eslint-disable-next-line no-console
  const log = (msg: string) => console.log(msg);
  let report: Awaited<ReturnType<typeof runCutoverCoverage>> | undefined;
  try {
    await app.init();
    const config = app.get(ConfigService);
    const drizzle = app.get(DrizzleService);
    const neo4j = app.get(DatabaseService);

    if (!config.postgres.url) {
      throw new Error(
        'POSTGRES_URL is required (the loaded database to count).',
      );
    }
    log(
      `\nCutover coverage — source ${config.neo4j.url} → ` +
        `target ${new URL(config.postgres.url).pathname.slice(1)}\n`,
    );
    report = await runCutoverCoverage(neo4j, drizzle.client, log);
  } finally {
    await app.close();
  }

  // ── The full label ledger: every name, its count, and its claim ────────────
  log('\n─── Labels (source count · claim · target check) ───');
  const width = Math.max(...report.labelRows.map((row) => row.label.length));
  for (const row of report.labelRows) {
    const counts =
      row.expected != null && row.actual != null
        ? ` → expected ${row.expected}, holds ${row.actual} ${row.ok ? '✓' : '✗'}`
        : '';
    log(
      `  ${row.label.padEnd(width)} ${String(row.sourceCount).padStart(9)}  ` +
        `${row.kind}${counts}`,
    );
  }
  if (report.staleManifest.length > 0) {
    log(
      `\n  ℹ ${report.staleManifest.length} manifest entr(ies) name things this source does not ` +
        `enumerate — expected across snapshots (scrub markers, retired names): ` +
        report.staleManifest.join(', '),
    );
  }

  log(
    `\n${report.checksRun} checks — ${report.sourceLabeledNodes.toLocaleString()} ` +
      `labeled source nodes accounted for against ` +
      `${report.targetRows.toLocaleString()} counted target rows.`,
  );

  const list = (
    findings: ReadonlyArray<{
      axis: string;
      name: string;
      detail: string;
      count?: number;
    }>,
  ) => {
    for (const finding of findings) {
      const count =
        finding.count != null ? ` [${finding.count.toLocaleString()}]` : '';
      log(
        `  · ${finding.axis} \`${finding.name}\`${count} — ${finding.detail}`,
      );
    }
  };

  if (report.clean) {
    log(
      '\n✓ Every name the source enumerates is claimed, no review questions are ' +
        'open, and every counted gap matches its written-down reason.\n',
    );
    exit();
  }
  if (report.unclaimed.length > 0) {
    log(
      `\n✗ UNCLAIMED — ${report.unclaimed.length} name(s) the source has and the manifest does not:\n`,
    );
    list(report.unclaimed);
  }
  if (report.reviews.length > 0) {
    log(
      `\n✗ OPEN DECISIONS — ${report.reviews.length} review question(s) blocking (answer, then reclassify):\n`,
    );
    list(report.reviews);
  }
  if (report.countMismatches.length > 0) {
    log(
      `\n✗ UNEXPLAINED COUNT GAPS — ${report.countMismatches.length} label(s):\n`,
    );
    list(report.countMismatches);
  }
  log('');
  exit(1);
}

void bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
