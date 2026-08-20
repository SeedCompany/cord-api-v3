/**
 * Post-load check that a cutover ETL result HOLDS TOGETHER.
 *
 * Reads only Postgres, and only what the database cannot enforce for itself:
 * references with no foreign key behind them, live rows whose target is
 * soft-deleted, foreign keys pointing at the right table but the wrong subtype,
 * duplicate or NULL array elements. See cutover/verify.ts for why each of those
 * is unenforceable and what the two report sections mean.
 *
 * Runs after `cutover.run` against the SAME target database. It reads no Neo4j
 * data, so it can be pointed at a load long after the source is gone — and it
 * writes nothing, so it is safe against the live target mid-cutover.
 *
 * The run forces `DATABASE=neo4j` on itself, which is what keeps it READ-ONLY.
 * `DrizzleService` connects whenever POSTGRES_URL is set regardless of engine,
 * but `DrizzleMigrator.onModuleInit` applies pending migrations whenever the
 * engine IS postgres — so booting the obvious way produces a verifier that
 * writes DDL to the database it is about to certify. Against an empty target it
 * would create the schema and then find nothing wrong with it. (The row census
 * inside `runCutoverVerify` is the other half of that guard: it refuses a
 * database with no rows rather than passing it.)
 *
 * Usage — only POSTGRES_URL matters:
 *   POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord_cutover \
 *     yarn start --entryFile core/cutover-verify.run
 *
 * Exit codes: 0 clean, 1 the load violates an invariant (or the run threw).
 * The watchlist never affects the exit code — it reports source oddities the
 * load carried faithfully, which are not reasons to stop.
 */
import { NestFactory } from '@nestjs/core';
import { exit } from 'node:process';
import '../polyfills';

async function bootstrap() {
  process.argv.push('console');

  // A verifier must not change what it is measuring. Booting the AppModule runs
  // AdminService.onApplicationBootstrap, which writes the root user into
  // whichever database is primary — so a "clean" run would be certifying rows it
  // had just created. Same guards, same reasoning, as cutover.run.ts and
  // shadow-diff.run.ts. Set before the AppModule import below, since
  // ConfigService reads env once.
  process.env.DB_ROOT_OBJECTS_SYNC = 'false';
  process.env.DB_CREATE_INDEXES = 'false';
  // And the third write path, which is the one that actually fired: under
  // `DATABASE=postgres`, DrizzleMigrator.onModuleInit applies pending migrations
  // to the target — DDL, issued by the tool that is about to certify it. Forced
  // rather than left to the caller because, unlike cutover.run.ts, nothing here
  // reads through a repository, so the engine has no legitimate effect on the
  // result. EnvironmentService seeds itself from process.env and dotenv does not
  // override what is already set, so this beats a DATABASE=postgres in .env.local.
  process.env.DATABASE = 'neo4j';

  const { AppModule } = await import('../app.module');
  const { ConfigService } = await import('~/core/config');
  const { DrizzleService } = await import('~/core/drizzle/drizzle.service');
  const { runCutoverVerify } = await import('./cutover/verify');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  // CLI script — its output IS the interface. Same as scrub.run.ts.
  // eslint-disable-next-line no-console
  const log = (msg: string) => console.log(msg);
  let report: Awaited<ReturnType<typeof runCutoverVerify>> | undefined;
  try {
    await app.init();
    const config = app.get(ConfigService);
    const drizzle = app.get(DrizzleService);

    if (!config.postgres.url) {
      throw new Error(
        'POSTGRES_URL is required (the loaded database to check).',
      );
    }
    log(
      `\nCutover verify — ${new URL(config.postgres.url).pathname.slice(1)}\n`,
    );
    report = await runCutoverVerify(drizzle.client, log);
  } finally {
    await app.close();
  }

  const table = (
    rows: ReadonlyArray<{ check: string; detail: string; count: number }>,
  ) => {
    const width = Math.max(...rows.map((row) => row.check.length));
    for (const row of rows) {
      log(
        `  ${row.check.padEnd(width)}  ${String(row.count).padStart(9)}  ${
          row.detail
        }`,
      );
    }
  };

  if (report.watchlist.length > 0) {
    log(
      `\nWatchlist — carried faithfully from the source, not load defects:\n`,
    );
    table(report.watchlist);
  }

  log(
    `\n${report.checksRun} checks over ` +
      `${report.rowsChecked.toLocaleString()} rows.`,
  );
  if (report.clean) {
    log(
      '✓ No violations — every invariant the database cannot enforce holds.\n',
    );
    exit();
  }
  log(
    `\n⚠ ${report.violations.length} VIOLATION(S) — this load is not usable:\n`,
  );
  table(report.violations);
  log('');
  exit(1);
}

void bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
