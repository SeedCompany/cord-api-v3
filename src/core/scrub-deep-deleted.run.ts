/**
 * ONE-OFF repair: scrub the field records the old label predicate skipped.
 *
 * Background. Neo4j's soft delete prefixes labels rather than setting a flag, so
 * a record deleted twice is `:Deleted_Deleted_Property`. Until 2026-08-20 both
 * the scrubber and its verifier matched `(p:Property OR p:Deleted_Property)`,
 * which stops at depth one — so a handful of records kept their original
 * production values and the verifier reported clean throughout.
 *
 * The code fix (`isFieldRecord`) means a FRESH scrub handles these correctly.
 * This script exists only because re-scrubbing an ALREADY-scrubbed copy is not
 * a repair: `fakeValue` is deterministic on its input, so running it over
 * existing fakes produces fakes-of-fakes and churns every value in the graph,
 * invalidating any Postgres load taken from it. This touches only the records
 * the old predicate missed and leaves everything else byte-identical.
 *
 * It reuses `fakeValue` with the strategy the classification already assigns to
 * each link, so a repaired value is exactly what a full scrub would have
 * written — which matters, because the same original may appear both live
 * (already faked) and here.
 *
 * migration-todo(cleanup): delete this file once every scrubbed copy has been
 * repaired or rebuilt. Kept rather than deleted on 2026-08-20 because the local
 * copy is not necessarily the only one — any other environment scrubbed before
 * that date carries the same leak, and a copy rebuilt from a fresh dump with the
 * fixed scrubber does not need this at all. The code fix is the durable part;
 * this only repairs data that was already written.
 *
 *   yarn start --entryFile core/scrub-deep-deleted.run -- --dry-run
 *   yarn start --entryFile core/scrub-deep-deleted.run
 */
import { NestFactory } from '@nestjs/core';
import { exit } from 'node:process';
import '../polyfills';

/** Depth two or deeper. Depth one is what the old predicate already covered. */
const DEEP = `any(lbl IN labels(p) WHERE lbl STARTS WITH 'Deleted_Deleted_')`;

interface DeepRow {
  nodeId: number;
  link: string;
  value: unknown;
}

async function bootstrap() {
  const dryRun = process.argv.includes('--dry-run');
  process.argv.push('console');

  // Booting the AppModule writes to the graph on its own — observed here as
  // `[admin:service] Updating root user to match app configuration`, which
  // rewrites the root user's email and password hash to match this box's config.
  // A repair script should change the 16 records it came for and nothing else,
  // and on a copy being used for read-parity work an unrelated write is noise
  // that shows up later as an unexplained difference. Set before the AppModule
  // import below, since ConfigService reads env once. Same guard, same reason,
  // as shadow-diff.run.ts.
  process.env.DB_ROOT_OBJECTS_SYNC = 'false';
  process.env.DB_CREATE_INDEXES = 'false';

  const { AppModule } = await import('../app.module');
  const { DatabaseService } = await import('~/core/neo4j');
  const { links } = await import('./scrub/classification');
  const { fakeValue } = await import('./scrub/fake');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const neo4j = app.get(DatabaseService);
  // CLI script — its output IS the interface. Same as scrub.run.ts.
  // eslint-disable-next-line no-console
  const log = (msg: string) => console.log(msg);

  try {
    const rows = [
      ...(await neo4j
        .query<DeepRow>(
          `MATCH ()-[r]->(p)
           WHERE ${DEEP} AND p.value IS NOT NULL
           RETURN id(p) AS nodeId, type(r) AS link, p.value AS value`,
        )
        .run()),
    ];
    log(
      `Found ${rows.length} field record(s) at soft-delete depth 2 or deeper.`,
    );
    if (rows.length === 0) {
      log('Nothing to repair.');
      return;
    }

    const byLink = new Map<string, number>();
    for (const row of rows) {
      byLink.set(row.link, (byLink.get(row.link) ?? 0) + 1);
    }
    for (const [link, count] of byLink) {
      log(`  ${link}: ${count}`);
    }

    // An unclassified or non-scrub link here is a real finding, not something to
    // skip quietly — the whole point of the allowlist is that nothing slips past
    // unexamined.
    const updates: Array<{ nodeId: number; value: string | null }> = [];
    const unclassified: string[] = [];
    for (const row of rows) {
      const action = links[row.link];
      if (!action) {
        unclassified.push(row.link);
        continue;
      }
      if (action.kind !== 'scrub') continue;
      updates.push({
        nodeId: row.nodeId,
        value: fakeValue(action.as, row.value),
      });
    }
    if (unclassified.length > 0) {
      throw new Error(
        `Refusing to run: ${[...new Set(unclassified)].join(', ')} is not in the ` +
          `classification. Classify it before repairing.`,
      );
    }

    log(
      `\n${dryRun ? 'Would replace' : 'Replacing'} ${updates.length} value(s).`,
    );
    if (dryRun) return;

    await neo4j
      .query(
        `UNWIND $batch AS row
         MATCH (p) WHERE id(p) = row.nodeId
         SET p.value = row.value,
             p.sortValue = CASE WHEN p.sortValue IS NULL THEN NULL ELSE row.value END`,
        { batch: updates },
      )
      .run();

    const left = [
      ...(await neo4j
        .query<{ total: number }>(
          `MATCH ()-[]->(p) WHERE ${DEEP} AND p.value IS NOT NULL
           RETURN count(p) AS total`,
        )
        .run()),
    ];
    log(
      `Repaired. ${Number(left[0]?.total ?? 0)} record(s) now at that depth.`,
    );
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
