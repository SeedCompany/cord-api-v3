/**
 * One-time Neo4j → Postgres data migration (cutover ETL).
 *
 * Reads every entity out of Neo4j (the current production DB) through the
 * proven Neo4j repositories and inserts it into the corresponding Postgres
 * (Drizzle) tables — ID-preserving, no service/hook side-effects. See
 * src/core/cutover/README.md for the full design.
 *
 * Boots with `DATABASE=neo4j` so `splitDb` resolves the NEO4J repositories
 * (the readers); `POSTGRES_URL` is the WRITE target (DrizzleService connects
 * whenever the url is set, regardless of engine). The target's schema is
 * applied here (migrations) before loading, so it can point at an empty DB.
 *
 * `DATABASE=neo4j` is MANDATORY on every invocation below and is not a default —
 * `.env`/`.env.local` commonly set it to postgres, and with that in effect
 * `splitDb` resolves the DRIZZLE repositories, so every read hydrates from the
 * EMPTY TARGET instead of the source. Ids still enumerate from Neo4j via raw
 * Cypher, so the run loads zero rows and reconciles `0 == 0 == 0 ✓` — an empty
 * migration that declares success. The banner prints `engine=`: check it.
 *
 * Usage (see README for the cutover runbook — freeze, load, validate, flip):
 *   # dry-run: read + map everything, write nothing (surfaces mapping errors)
 *   DATABASE=neo4j \
 *   POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord_cutover \
 *     yarn start --entryFile core/cutover.run -- --dry-run
 *
 *   # real load of one domain
 *   DATABASE=neo4j POSTGRES_URL=... \
 *     yarn start --entryFile core/cutover.run -- --only=tool
 *
 *   # full load (--batch=100 at production volume: 500 exceeds Neo4j's
 *   # dbms.memory.transaction.total.max)
 *   DATABASE=neo4j POSTGRES_URL=... \
 *     yarn start --entryFile core/cutover.run -- --batch=100
 *
 * Flags: --dry-run | --only=a,b,c | --batch=N | --no-migrate | --strict
 *        --allow-other-sessions (load even though somebody else is connected
 *        to the target — they lose their session at the truncate)
 *
 * Exit codes: 0 clean, 1 a table MISMATCHed (a write did not land) or the run
 * threw, 2 under --strict when rows were lost but nothing broke.
 */
import { NestFactory } from '@nestjs/core';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import fs from 'node:fs';
import path from 'node:path';
import { exit } from 'node:process';
import '../polyfills';

const parseFlags = (argv: readonly string[]) => {
  const get = (name: string) =>
    argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const has = (name: string) => argv.includes(`--${name}`);
  // A bad --batch must not be allowed through: `chunk(ids, NaN)` yields no
  // chunks at all, so the run would read and insert NOTHING and still reconcile,
  // and a value large enough overruns the driver's 65,535 bind parameters
  // mid-load. Fail here instead, where the message can say why.
  const rawBatch = get('batch');
  let batchSize = 500;
  if (rawBatch != null) {
    batchSize = Number(rawBatch);
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
      throw new Error(
        `--batch must be a whole number between 1 and 1000 (got ${rawBatch}). ` +
          `Use --batch=100 at production volume.`,
      );
    }
  }
  return {
    dryRun: has('dry-run'),
    migrate: !has('no-migrate'),
    strict: has('strict'),
    // Load even though somebody else is connected to the target. They lose
    // their session at the truncate and their writes read afterwards as a
    // reconciliation mismatch, so this is a deliberate choice, never a default.
    allowOtherSessions: has('allow-other-sessions'),
    only: get('only')?.split(',').filter(Boolean),
    batchSize,
  };
};

async function bootstrap() {
  // Capture cutover flags, THEN push 'console' so ConfigService.isCli is true
  // (DataLoaders resolve against CLI_CONTEXT_ID, scheduler off) — same trick as
  // pg-seed.run.ts / repl.ts.
  const flags = parseFlags(process.argv.slice(2));
  process.argv.push('console');

  // The ETL must never WRITE to the source graph. Booting the full AppModule
  // starts AdminService.onApplicationBootstrap, which outside jest runs
  // `setupRootObjects()` in the BACKGROUND (unawaited) against Neo4j — and if
  // this box's ROOT_USER/PASSWORD_SECRET differ from production's, it rewrites
  // the root user's email and password hash. That is a write into the graph the
  // runbook has just frozen, it races the user extractor's read, and it would
  // break root login on the Neo4j rollback path. The flag defaults to TRUE
  // whenever NODE_ENV is not development, which is exactly the cutover box.
  // Set before the AppModule import below, since ConfigService reads env once.
  process.env.DB_ROOT_OBJECTS_SYNC = 'false';
  // Same reasoning for index creation: it is DDL against the source.
  process.env.DB_CREATE_INDEXES = 'false';

  // AppModule FIRST, then dynamic imports (circular-dep ordering).
  const { AppModule } = await import('../app.module');
  const { ModuleRef } = await import('@nestjs/core');
  const { ConfigService } = await import('~/core/config');
  const { DrizzleService } = await import('~/core/drizzle/drizzle.service');
  const { DatabaseService } = await import('~/core/neo4j');
  const { SessionManager } =
    await import('~/core/authentication/session/session.manager');
  const { runCutover } = await import('./cutover/cutover.harness');
  const { extractors } = await import('./cutover/extractors');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  // eslint-disable-next-line no-console
  const log = (msg: string) => console.log(msg);
  let result: Awaited<ReturnType<typeof runCutover>> | undefined;
  try {
    await app.init();

    const config = app.get(ConfigService);
    const drizzle = app.get(DrizzleService);
    const neo4j = app.get(DatabaseService);
    const sessions = app.get(SessionManager);
    const moduleRef = app.get(ModuleRef);

    if (!config.postgres.url) {
      throw new Error('POSTGRES_URL is required (the cutover write target).');
    }
    log(
      `\nCutover ETL — engine=${config.databaseEngine} (Neo4j source) → ` +
        `Postgres target ${new URL(config.postgres.url).pathname}\n`,
    );

    // The migrator only auto-runs under engine=postgres; we boot as neo4j, so
    // apply the target schema here (unless it's already migrated).
    if (flags.migrate && !flags.dryRun) {
      log('Applying target schema (migrations)…');
      await migrate(drizzle.client, {
        migrationsFolder: path.join(
          process.cwd(),
          'src/core/drizzle/migrations',
        ),
      });
    }

    const rootSession = await sessions.lazySessionForRootUser();
    result = await sessions.asUser(rootSession, async () => {
      return await runCutover(
        {
          neo4j,
          db: drizzle.client,
          moduleRef,
          dryRun: flags.dryRun,
          batchSize: flags.batchSize,
          allowOtherSessions: flags.allowOtherSessions,
          notHydrated: new Map(),
          defaulted: new Map(),
          log,
        },
        extractors,
        { only: flags.only },
      );
    });
  } finally {
    await app.close();
  }

  // The loss profile, machine-readable — the A4 premise is that a healthy
  // load's losses are STABLE across source snapshots, so a fresh manifest is
  // comparable against the committed baseline (new cause / growth = a
  // regression to investigate). Dry runs skip it: their drop counts are
  // structurally zero, so a dry-run manifest would only overwrite a real one
  // with nothing.
  if (result && !flags.dryRun) {
    // One file per run, not one overwritten each time — repeated rehearsal
    // runs (QA) need their own history to compare against each other, not
    // just against the baseline.
    const manifestDir = path.join(process.cwd(), 'cutover-loss-manifests');
    fs.mkdirSync(manifestDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const manifestPath = path.join(
      manifestDir,
      `${timestamp}-cutover-loss-manifest.json`,
    );
    const manifestJson = JSON.stringify(result.manifest, null, 2);
    fs.writeFileSync(manifestPath, manifestJson);
    // Printed in full, not just the path: the file above only survives when
    // this runs somewhere with a persistent filesystem. Run as a one-off ECS
    // task instead, and the container (and that file) is gone the moment the
    // task stops — this log line is what actually survives, since it rides
    // along on whatever's already capturing stdout (CloudWatch for ECS).
    log(
      `\n--- cutover-loss-manifest (${timestamp}) ---\n` +
        `${manifestJson}\n` +
        `--- end cutover-loss-manifest ---\n\n` +
        `Also written to ${manifestPath}, if this filesystem is persistent.\n` +
        'Compare two manifests against each other: node ' +
        'src/core/cutover/compare-loss-manifest.ts <baseline.json> <fresh.json>',
    );
  }

  // A MISMATCH means a write did not land — the load is broken, so say so in the
  // exit code rather than only in scrollback. Row LOSS is different: guard drops
  // are expected and documented (a soft-deleted parent takes its children), so
  // it stays a success by default and only fails under --strict.
  if (!result?.allOk) {
    log('\nExiting 1 — a table MISMATCHed, so the load is not usable.');
    exit(1);
  }
  if (flags.strict && result.totalLost > 0) {
    log(`\nExiting 2 (--strict) — ${result.totalLost} row(s) did not make it.`);
    exit(2);
  }
  exit();
}

void bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
