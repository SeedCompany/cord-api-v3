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
 * Usage (see README for the cutover runbook — freeze, load, validate, flip):
 *   # dry-run: read + map everything, write nothing (surfaces mapping errors)
 *   POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord_cutover \
 *     yarn start --entryFile core/cutover.run -- --dry-run
 *
 *   # real load of one domain
 *   POSTGRES_URL=... yarn start --entryFile core/cutover.run -- --only=tool
 *
 *   # full load
 *   POSTGRES_URL=... yarn start --entryFile core/cutover.run
 *
 * Flags: --dry-run | --only=a,b,c | --batch=N | --no-migrate
 */
import { NestFactory } from '@nestjs/core';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { exit } from 'node:process';
import '../polyfills';

const parseFlags = (argv: readonly string[]) => {
  const get = (name: string) =>
    argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const has = (name: string) => argv.includes(`--${name}`);
  return {
    dryRun: has('dry-run'),
    migrate: !has('no-migrate'),
    only: get('only')?.split(',').filter(Boolean),
    batchSize: get('batch') ? Number(get('batch')) : 500,
  };
};

async function bootstrap() {
  // Capture cutover flags, THEN push 'console' so ConfigService.isCli is true
  // (DataLoaders resolve against CLI_CONTEXT_ID, scheduler off) — same trick as
  // pg-seed.run.ts / repl.ts.
  const flags = parseFlags(process.argv.slice(2));
  process.argv.push('console');

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
    await sessions.asUser(rootSession, async () => {
      await runCutover(
        {
          neo4j,
          db: drizzle.client,
          moduleRef,
          dryRun: flags.dryRun,
          batchSize: flags.batchSize,
          log,
        },
        extractors,
        { only: flags.only },
      );
    });
  } finally {
    await app.close();
  }
  exit();
}

void bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
