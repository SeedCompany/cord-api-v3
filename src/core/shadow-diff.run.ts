/**
 * Shadow-diff harness — Neo4j ↔ Postgres read parity (cutover-only tooling).
 *
 * Capture mode boots the app under the current `DATABASE` engine, replays a
 * read-only GraphQL corpus IN-PROCESS under several role personas, and writes
 * `capture-<engine>.json`. Diff mode compares the two capture files
 * (neo4j = oracle) with a known-deltas suppression registry and writes
 * `report.md` + `report.json`. See src/core/shadow-diff/README.md.
 *
 * Usage (both engines must be loaded with the SAME dataset via the cutover
 * ETL first — see the README runbook):
 *
 *   DATABASE=neo4j POSTGRES_URL=postgresql://... \
 *     yarn start --entryFile core/shadow-diff.run -- --capture
 *
 *   DATABASE=postgres POSTGRES_URL=postgresql://... \
 *     yarn start --entryFile core/shadow-diff.run -- --capture
 *
 *   yarn start --entryFile core/shadow-diff.run -- --diff
 *
 * Flags: --capture | --diff | --out=<dir> (capture) | --dir=<dir> (diff).
 * Default dir: shadow-diff-output/ at the repo root.
 * Diff exits 1 when any UNSUPPRESSED difference is found.
 */
import { NestFactory } from '@nestjs/core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { exit } from 'node:process';
import type { CaptureFile } from './shadow-diff/types';
import '../polyfills';

const parseFlags = (argv: readonly string[]) => {
  const get = (name: string) =>
    argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const has = (name: string) => argv.includes(`--${name}`);
  return {
    capture: has('capture'),
    diff: has('diff'),
    dir:
      get('out') ??
      get('dir') ??
      path.join(process.cwd(), 'shadow-diff-output'),
  };
};

// eslint-disable-next-line no-console
const log = (msg: string) => console.log(msg);

/** Pure file processing — no app boot needed. */
async function runDiff(dir: string) {
  const { diffCaptures } = await import('./shadow-diff/diff');
  const { renderMarkdown, summaryLines } = await import('./shadow-diff/report');

  const read = (engine: string) => {
    const file = path.join(dir, `capture-${engine}.json`);
    if (!fs.existsSync(file)) {
      throw new Error(
        `Missing ${file} — run --capture under DATABASE=${engine} first.`,
      );
    }
    // Captures are produced by this same tool; trust their shape.
    return JSON.parse(fs.readFileSync(file, 'utf8')) as CaptureFile;
  };
  const neo4j = read('neo4j');
  const postgres = read('postgres');

  const report = diffCaptures(neo4j, postgres);

  fs.writeFileSync(
    path.join(dir, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  fs.writeFileSync(path.join(dir, 'report.md'), renderMarkdown(report));
  for (const line of summaryLines(report)) log(line);
  log(`\nWrote ${path.join(dir, 'report.md')} + report.json`);

  process.exit(report.totals.withDiffs > 0 ? 1 : 0);
}

async function runCaptureMode(dir: string) {
  // Push 'console' AFTER flag parsing so ConfigService.isCli is true —
  // DataLoaders resolve against CLI_CONTEXT_ID, the scheduler stays off, and
  // loader caching is disabled. Same trick as cutover.run.ts / pg-seed.run.ts.
  process.argv.push('console');

  // AppModule FIRST, then dynamic imports (circular-dep ordering — same as
  // main.ts / cutover.run.ts / pg-seed.run.ts).
  const { AppModule } = await import('../app.module');
  const { GraphQLSchemaHost } = await import('@nestjs/graphql');
  const { ConfigService } = await import('~/core/config');
  const { Identity } = await import('~/core/authentication');
  const { SessionManager } =
    await import('~/core/authentication/session/session.manager');
  const { DrizzleService } = await import('~/core/drizzle/drizzle.service');
  const { GqlContextHostImpl } =
    await import('~/core/graphql/gql-context.host');
  const { HttpAdapter } = await import('~/core/http');
  const { runCapture } = await import('./shadow-diff/capture');

  // A FULL Nest app (not an application context): GraphQLModule only builds
  // the schema when an HTTP adapter is present (same recipe as main.ts's
  // --gen-schema path). We init but never listen.
  const app = await NestFactory.create(AppModule, new HttpAdapter(), {
    logger: ['error', 'warn'],
  });
  try {
    await app.init();

    const config = app.get(ConfigService);
    if (!config.postgres.url) {
      throw new Error(
        'POSTGRES_URL is required — personas + id samples are resolved from ' +
          'Postgres in both capture runs.',
      );
    }
    const engine = config.databaseEngine;
    if (engine !== 'neo4j' && engine !== 'postgres') {
      throw new Error(
        `DATABASE must be neo4j or postgres for a capture (got '${engine}').`,
      );
    }

    // Scrub gate. Capture WRITES every response it reads to a file, so an
    // unscrubbed source means protected values land on disk — which is the
    // failure redact.ts exists to bound, and this is the layer that stops it
    // happening at all.
    //
    // Only the neo4j capture is checked, because only it reads Neo4j directly.
    // The postgres capture reads a database the ETL loaded, and the ETL is gated
    // on the same check — so prod data cannot reach Postgres unmarked either.
    if (engine === 'neo4j') {
      const { DatabaseService } = await import('~/core/neo4j');
      const { checkScrubGate } = await import('./scrub/provenance');
      const gate = await checkScrubGate(app.get(DatabaseService));
      if (!gate.allowed) {
        throw new Error(`Capture refused — ${gate.reason}`);
      }
      log(`Source: ${gate.reason}`);
    }

    // Warm the root session so CLI-mode loaders (ResourceLoader.readyForCli)
    // don't race the admin bootstrap.
    await app.get(SessionManager).lazySessionForRootUser();

    await runCapture(
      {
        schema: app.get(GraphQLSchemaHost).schema,
        identity: app.get(Identity),
        gqlContextAls: app.get(GqlContextHostImpl).als,
        db: app.get(DrizzleService).client,
        engine,
        log,
      },
      dir,
    );
  } finally {
    await app.close();
  }
  exit();
}

async function bootstrap() {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.diff === flags.capture) {
    log('Usage: --capture [--out=<dir>] | --diff [--dir=<dir>]');
    process.exit(1);
  }
  if (flags.diff) {
    await runDiff(flags.dir);
    return;
  }
  await runCaptureMode(flags.dir);
}

void bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
