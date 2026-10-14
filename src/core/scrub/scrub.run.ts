/**
 * Scrub a restored production copy so it is safe to develop against, and
 * optionally dump the result.
 *
 * Point it at a THROWAWAY database whose name starts with `cord_scrub_` — it
 * rewrites that database in place and refuses any other name. `POSTGRES_URL`
 * must be given on the command line; `.env.local` is deliberately not read, so
 * the target is visible in the command that ran.
 *
 *   # count what would change, write nothing
 *   POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord_scrub_20261014?sslmode=no-verify \
 *     yarn scrub --dry-run
 *
 *   # scrub, verify, and write the portable dump
 *   SCRUB_DEV_PASSWORD=localdev POSTGRES_URL=... \
 *     yarn scrub --source='prod snapshot 2026-10-14' --out=~/cord-dev-seed/cord-scrubbed-20261014.dump
 *
 *   # verify any copy, read-only
 *   POSTGRES_URL=... yarn scrub --verify-only
 *
 * Flags: --dry-run | --verify-only | --batch=N | --out=<file> | --source=<label>
 *
 * Environment: SCRUB_DEV_PASSWORD (required for a real run — every account gets
 * it), PASSWORD_SECRET (the same pepper the app uses, if the target environment
 * sets one), PG_DUMP (path to a pg_dump binary when it is not on PATH).
 *
 * Does NOT boot the application. Booting would run migrations and the root-user
 * sync against the copy before it is scrubbed.
 */
import * as argon2 from 'argon2';
import { execSync, spawn } from 'node:child_process';
import { closeSync, openSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { exit } from 'node:process';
import { Client } from 'pg';
import '../../polyfills';
import { readProvenance } from './provenance';
import { runScrub } from './scrub';
import { runVerify } from './verify';

// A CLI script whose output IS the interface.
// eslint-disable-next-line no-console
const log = (msg: string) => console.log(msg);

const parseFlags = (argv: readonly string[]) => {
  const get = (name: string) =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const has = (name: string) => argv.includes(`--${name}`);
  const known = ['dry-run', 'verify-only', 'batch', 'out', 'source'];
  const unknown = argv.filter(
    (arg) =>
      arg.startsWith('--') && !known.includes(arg.slice(2).split('=')[0]!),
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown flag(s): ${unknown.join(' ')}`);
  }
  return {
    dryRun: has('dry-run'),
    verifyOnly: has('verify-only'),
    batchSize: get('batch') ? Number(get('batch')) : 5000,
    out: get('out'),
    source: get('source') ?? null,
  };
};

/**
 * Same connection rules as `DrizzleService`: `sslmode=no-verify` skips
 * certificate verification (local, SSM tunnel); anything else verifies against
 * the RDS CA bundle; `sslmode=disable` turns SSL off.
 */
const connect = async (url: string): Promise<Client> => {
  const parsed = new URL(url);
  const sslmode = parsed.searchParams.get('sslmode');
  parsed.searchParams.delete('sslmode');
  const ssl =
    sslmode === 'disable'
      ? false
      : sslmode === 'no-verify'
        ? { rejectUnauthorized: false }
        : {
            ca: readFileSync(
              join(import.meta.dirname, '..', 'drizzle', 'rds-ca-bundle.pem'),
              'utf8',
            ),
          };
  const client = new Client({ connectionString: parsed.toString(), ssl });
  await client.connect();
  return client;
};

const toolCommit = (): string | null => {
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
};

/**
 * `pg_dump -Fc` of the scrubbed database to `out`, through whatever `pg_dump`
 * is on PATH (or `PG_DUMP`). When there is none — a laptop whose only Postgres
 * is the compose container — prints the one-liner to run inside the container
 * instead, and does not fail: the scrub itself succeeded.
 */
const dumpTo = async (out: string, url: string, database: string) => {
  const bin = process.env.PG_DUMP ?? 'pg_dump';
  const parsed = new URL(url);
  parsed.searchParams.delete('sslmode');
  const fd = openSync(out, 'w');
  let written = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        bin,
        [
          '--format=custom',
          '--no-owner',
          '--no-privileges',
          '--dbname',
          parsed.toString(),
        ],
        { stdio: ['ignore', fd, 'inherit'] },
      );
      child.on('error', reject);
      child.on('exit', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`${bin} exited with ${code ?? 'a signal'}`)),
      );
    });
    written = true;
    log(`\nWrote ${out}`);
  } catch (error) {
    const missing =
      error instanceof Error && 'code' in error && error.code === 'ENOENT';
    if (!missing) throw error;
    log(
      `\n⚠ No pg_dump on PATH, so the dump was not written. From the compose ` +
        `container:\n  docker compose exec -T postgres pg_dump --format=custom ` +
        `--no-owner --no-privileges -U postgres ${database} > ${out}`,
    );
  } finally {
    closeSync(fd);
    // Never leave an empty or partial file where a dump was expected.
    if (!written) unlinkSync(out);
  }
};

const main = async () => {
  const flags = parseFlags(process.argv.slice(2));
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      'POSTGRES_URL is required on the command line (it is deliberately not read from .env.local).',
    );
  }
  const database = new URL(url).pathname.slice(1);

  const devPassword = process.env.SCRUB_DEV_PASSWORD;
  if (!devPassword && !flags.dryRun && !flags.verifyOnly) {
    throw new Error(
      'SCRUB_DEV_PASSWORD is required for a real run — every account in the ' +
        'copy is set to it, and it is the only way to log in afterwards.',
    );
  }
  const secret = process.env.PASSWORD_SECRET;
  const devPasswordHash = devPassword
    ? await argon2.hash(devPassword, {
        ...(secret && { secret: Buffer.from(secret, 'utf-8') }),
      })
    : 'dry-run';

  const client = await connect(url);
  try {
    if (flags.verifyOnly) {
      const provenance = await readProvenance(client);
      log(
        provenance
          ? `\nMarked scrubbed ${provenance.scrubbedAt.toISOString()} — ` +
              `${provenance.valuesReplaced.toLocaleString('en-US')} values replaced, ` +
              `classification ${provenance.classificationHash}` +
              (provenance.sourceLabel
                ? `, source "${provenance.sourceLabel}"`
                : '') +
              '\n'
          : '\n⚠ No scrub marker in this database.\n',
      );
    } else {
      log(
        flags.dryRun
          ? '\nDRY RUN — reading and counting only; the transaction is rolled back.\n'
          : `\nScrubbing "${database}" in place.\n`,
      );
      const report = await runScrub({
        client,
        batchSize: flags.batchSize,
        log,
        devPasswordHash,
        dryRun: flags.dryRun,
        sourceLabel: flags.source,
        toolCommit: toolCommit(),
      });
      const n = (x: number) => x.toLocaleString('en-US');
      log(
        `\n${flags.dryRun ? 'Would replace' : 'Replaced'} ${n(report.valuesReplaced)} value(s), ` +
          `${flags.dryRun ? 'reset' : 'reset'} ${n(report.credentialsCleared)} password(s), ` +
          `${flags.dryRun ? 'empty' : 'emptied'} ${n(report.rowsTruncated)} row(s).`,
      );
    }

    // Verification always runs, including after a dry run — on an unscrubbed
    // copy it reports what is currently exposed, which proves the probes fire
    // rather than passing vacuously.
    log('\nVerifying —');
    const verify = await runVerify(client);
    if (verify.clean) {
      log('  no violations.');
    } else {
      for (const violation of verify.violations) {
        log(
          `  ✗ ${violation.field}: ${violation.count.toLocaleString('en-US')} — ${violation.probe}`,
        );
      }
    }
    for (const item of verify.watchlist) {
      log(
        `  • ${item.field}: ${item.count.toLocaleString('en-US')} — ${item.probe}`,
      );
    }

    if (!flags.dryRun && !flags.verifyOnly && !verify.clean) {
      log(
        '\n⚠ Scrub completed but verification found survivors. Treat this copy as ' +
          'unscrubbed until the columns above are resolved.',
      );
      return 1;
    }
    if (flags.out && !flags.dryRun && !flags.verifyOnly) {
      await dumpTo(flags.out, url, database);
    }
    return 0;
  } finally {
    await client.end();
  }
};

try {
  exit(await main());
} catch (error) {
  log(`\n✗ ${error instanceof Error ? error.message : String(error)}`);
  exit(1);
}
