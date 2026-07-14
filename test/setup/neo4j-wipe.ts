import * as Neo from 'neo4j-driver';

/**
 * Wipe the Neo4j database after a spec file — explicit opt-in + localhost only.
 *
 * Why: CI gives each E2E shard ONE Neo4j service container shared by every
 * spec file in the shard (unlike Gel/PG, which get ephemeral per-file DBs).
 * Data accumulates across files, so heavy specs run on an ever-fatter graph
 * and intermittently blow their timeouts depending on runner speed — the
 * chronic "neo4j 3/6 / 5/6" flake. Wiping at file teardown gives every file
 * the same empty starting state; the app re-bootstraps root/default objects
 * on its next boot exactly as it does on a fresh container.
 *
 * Safety — this deletes EVERY node in the target database, so two independent
 * gates keep it away from real data (the local compose `db` is a long-lived
 * dev database and the cutover-ETL source; prod runs Neo4j until the PG flip):
 * 1. `NEO4J_TEST_WIPE` must be explicitly set to `true` — only the CI
 *    workflow sets it. Nothing keys off ambient env like `CI`, so self-hosted
 *    runners or local shells can't trip it by accident.
 * 2. The target host must be loopback. A wipe opt-in pointed at a remote host
 *    is always a misconfiguration — we throw loudly instead of silently
 *    skipping, so the flake this exists to fix can't quietly return.
 */
export const wipeNeo4jAfterFile = async () => {
  if (process.env.NEO4J_TEST_WIPE !== 'true') return;
  const url = process.env.NEO4J_URL ?? 'bolt://localhost';
  const host = new URL(url).hostname;
  const loopback = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (!loopback.has(host)) {
    throw new Error(
      `NEO4J_TEST_WIPE is set but NEO4J_URL points at non-loopback host "${host}".` +
        ' Refusing to wipe a remote Neo4j — fix the environment: the wipe is' +
        ' only for ephemeral per-job test containers.',
    );
  }
  const auth = process.env.NEO4J_USERNAME
    ? Neo.auth.basic(
        process.env.NEO4J_USERNAME,
        process.env.NEO4J_PASSWORD ?? '',
      )
    : undefined;
  const driver = auth ? Neo.driver(url, auth) : Neo.driver(url);
  try {
    const session = driver.session({
      database: process.env.NEO4J_DBNAME || undefined,
      defaultAccessMode: Neo.session.WRITE,
    });
    try {
      // Test datasets are small (a few thousand nodes per file at most), so a
      // single-pass delete is fine — no need for apoc batching.
      await session.run('MATCH (n) DETACH DELETE n');
    } finally {
      await session.close();
    }
  } finally {
    await driver.close();
  }
};
