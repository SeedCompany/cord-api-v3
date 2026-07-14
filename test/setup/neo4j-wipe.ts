import * as Neo from 'neo4j-driver';

/**
 * Wipe the Neo4j database after a spec file — CI ONLY.
 *
 * Why: CI gives each E2E shard ONE Neo4j service container shared by every
 * spec file in the shard (unlike Gel/PG, which get ephemeral per-file DBs).
 * Data accumulates across files, so heavy specs run on an ever-fatter graph
 * and intermittently blow their timeouts depending on runner speed — the
 * chronic "neo4j 3/6 / 5/6" flake. Wiping at file teardown gives every file
 * the same empty starting state; the app re-bootstraps root/default objects
 * on its next boot exactly as it does on a fresh container.
 *
 * NEVER runs locally (gated on CI env): the local compose `db` is a
 * long-lived dev database — and the cutover-ETL source — so wiping it would
 * destroy real data. Local runs keep today's accumulate-forever behavior.
 */
export const wipeNeo4jAfterFile = async () => {
  if (!process.env.CI) return;
  const url = process.env.NEO4J_URL ?? 'bolt://localhost';
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
