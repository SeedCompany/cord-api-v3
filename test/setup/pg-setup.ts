import { DateTime } from 'luxon';
import { Pool } from 'pg';

// Repo-specific prefix so the stale sweep only ever touches THIS project's
// ephemeral databases, never an unrelated `test_*` DB on a shared Postgres.
const TEST_DB_PREFIX = 'cord_e2e_';

/**
 * Creates an empty, uniquely named database for the current spec file.
 * The app applies migrations (DrizzleMigrator) and root objects
 * (AdminDrizzleService) itself on boot, so no template/seeding is needed here.
 */
export const ephemeralPg = async () => {
  if (process.env.DATABASE !== 'postgres') {
    return undefined;
  }

  const base = new URL(
    process.env.POSTGRES_URL ??
      'postgresql://postgres:postgres@localhost:5432/cord',
  );
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
  const res = await admin.query<{ datname: string }>(
    'select datname from pg_database where datname like $1',
    [likePattern],
  );

  const stale = res.rows
    .map((row) => row.datname)
    .filter((name) => {
      const ts = Number(name.slice(TEST_DB_PREFIX.length).split('_')[0]);
      if (isNaN(ts)) {
        return false;
      }
      const createdAt = DateTime.fromMillis(ts);
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
