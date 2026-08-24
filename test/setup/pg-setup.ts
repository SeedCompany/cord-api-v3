import { DateTime } from 'luxon';
import { Pool } from 'pg';

// Repo-specific prefix so the stale sweep only ever touches THIS project's
// ephemeral databases, never an unrelated `test_*` DB on a shared Postgres.
const TEST_DB_PREFIX = 'cord_e2e_';

/**
 * Creates an empty, uniquely named database for the current spec file.
 * The app applies migrations (DrizzleMigrator) and root objects
 * (AdminDrizzleService) itself on boot, so no template/seeding is needed here.
 *
 * Unless {@link E2E_REUSE_DB} says otherwise — see below.
 */

/**
 * Run the specs against an EXISTING database instead of a fresh empty one.
 *
 * Set it to a database name and every spec in the run connects to that database
 * and never drops it:
 *
 *   DATABASE=postgres POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/postgres \
 *   E2E_REUSE_DB=cord_e2e_loaded yarn test:e2e --testPathPatterns 'project'
 *
 * (`--testPathPatterns` with the s — jest 30 renamed it, and the old spelling is
 * rejected outright rather than ignored.)
 *
 * ⚠ Across the whole suite use `--maxWorkers=1 --workerIdleMemoryLimit=2GB`, NOT
 * `--runInBand`: in-band puts all 49 spec files in one process, each booting a
 * full app against millions of rows, and it exhausts an 8GB heap around the 34th.
 * One worker is still sequential — which a shared database needs — but recycles.
 *
 * This exists to answer one question the cutover ETL cannot answer about itself:
 * a load can pass `cutover-verify.run` — every reference resolves, nothing points
 * at a deleted row — and the APPLICATION can still fail on it, because the
 * verifier checks the shape of the data and not the queries that read it. Only
 * running the real suite against real loaded rows tests that.
 *
 * ⚠ **The specs write.** They create, update and delete, and nothing here rolls
 * that back. Point this at a THROWAWAY COPY, never at the load itself:
 *
 *   create database cord_e2e_loaded template cord_cutover_verify;
 *
 * ⚠ Also expect legitimate failures that are not defects. A spec that asserts on
 * a whole list, or on a count, is written against a database holding only what it
 * just created; against five million pre-existing rows it fails by design. Those
 * are worth reading one at a time — the interesting ones are queries that BREAK
 * (timeouts, wrong joins, unique collisions with real data), not assertions that
 * merely counted something bigger than they expected.
 *
 * Deliberately a separate variable rather than "reuse whatever POSTGRES_URL
 * names". POSTGRES_URL is already required here (and points at a server, with
 * ephemeral databases created beside it), so overloading it would mean a stray
 * export silently turns every e2e run into a run against a real database that it
 * then mutates. This has to be asked for by name.
 *
 * migration-todo(cutover-cleanup): keep past cutover — it is how a rehearsal load
 * gets exercised — but the Neo4j-shaped bits around it go with the rest.
 */
const REUSE_DB = process.env.E2E_REUSE_DB;

export const ephemeralPg = async () => {
  if (process.env.DATABASE !== 'postgres') {
    return undefined;
  }

  if (REUSE_DB) {
    if (!process.env.POSTGRES_URL) {
      throw new Error(
        'POSTGRES_URL is required alongside E2E_REUSE_DB (it supplies the ' +
          'host and credentials; E2E_REUSE_DB supplies the database name)',
      );
    }
    const reused = new URL(process.env.POSTGRES_URL);
    reused.pathname = `/${REUSE_DB}`;
    // No cleanup: dropping the database the caller asked us to reuse would
    // destroy the thing under test, and on a shared run would do it while other
    // spec files are still connected.
    const keep = async () => {
      // Intentionally nothing.
    };
    return { url: reused.toString(), cleanup: keep };
  }

  // Mirror the app's DrizzleService, which refuses to guess a connection when
  // DATABASE=postgres. Note: .env.local is NOT visible here — this setup reads
  // raw process.env before ConfigService loads dotenv — so POSTGRES_URL must be
  // a real env var (CI sets it; locally export it or pass it on the CLI).
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      'POSTGRES_URL is required to run e2e tests with DATABASE=postgres',
    );
  }
  const base = new URL(process.env.POSTGRES_URL);
  const admin = new Pool({ connectionString: base.toString(), max: 1 });
  const dbName = `${TEST_DB_PREFIX}${Date.now()}_${String(Math.random()).slice(
    2,
  )}`;

  try {
    await dropStale(admin);
    await admin.query(`create database ${dbName}`);
  } catch (e) {
    // cleanup() never runs if setup throws, so close the admin pool here —
    // otherwise this is the one path that would leak it.
    await admin.end();
    throw e;
  }

  const url = new URL(base.toString());
  url.pathname = `/${dbName}`;

  const cleanup = async () => {
    try {
      await admin.query(`drop database ${dbName} with (force)`);
    } catch {
      // Best-effort: teardown must never fail app.close(). If the drop loses a
      // race (e.g. dropStale on a concurrent worker already reaped it), the
      // stale sweep on a later run catches any leftover. The pool end below
      // still runs, so we don't leak admin connections across workers.
    } finally {
      await admin.end();
    }
  };

  return { url: url.toString(), cleanup };
};

async function dropStale(admin: Pool) {
  // Escape `_` (a LIKE single-char wildcard) in the prefix so it matches
  // literally; parameterized to keep it scoped to our prefix only.
  const likePattern = TEST_DB_PREFIX.replace(/_/g, String.raw`\_`) + '%';
  const staleCandidatesResult = await admin.query<{ datname: string }>(
    'select datname from pg_database where datname like $1',
    [likePattern],
  );

  const stale = staleCandidatesResult.rows
    .map((row) => row.datname)
    .filter((name) => {
      const timestamp = Number(name.slice(TEST_DB_PREFIX.length).split('_')[0]);
      if (isNaN(timestamp)) {
        return false;
      }
      const createdAt = DateTime.fromMillis(timestamp);
      // more than 1 hour old
      return createdAt.diffNow().as('hours') < -1;
    });

  await Promise.all(
    stale.map(
      async (name) =>
        // Another worker may be sweeping concurrently; losing the race is fine.
        await admin
          .query(`drop database ${name} with (force)`)
          .catch(() => undefined),
    ),
  );
}
