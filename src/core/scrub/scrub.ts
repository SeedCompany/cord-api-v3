import { chunk } from 'lodash';
import { type DatabaseService } from '~/core/neo4j';
import {
  type Action,
  findUnclassified,
  links,
  properties,
} from './classification';
import { fakeValue, sortValueFor } from './fake';
import { MARKER_PROPERTY_KEYS, stampProvenance } from './provenance';

/**
 * The scrub itself.
 *
 * Runs in three passes, in this order and for this reason:
 *
 *  1. **Credentials.** First, and separately, so an interrupted run cannot leave
 *     working secrets behind. A dump contains live session tokens, live
 *     password-reset tokens and live webhook signing secrets — the one category
 *     where a half-finished scrub is worse than none, because the graph looks
 *     partly cleaned.
 *  2. **Dead keys.** Removed outright. Absent data cannot leak and does not need
 *     re-reviewing every time the classification is revisited.
 *  3. **Everything else.** Field records first (the `:Property` chain behind each
 *     classified link), then direct node properties.
 *
 * Both live and soft-deleted field records are covered. That is not a detail:
 * the version chain keeps every previous value, so scrubbing only the current one
 * leaves the history of what a field used to say fully intact.
 */

export interface ScrubContext {
  readonly neo4j: DatabaseService;
  readonly batchSize: number;
  readonly log: (msg: string) => void;
  /**
   * Hash to write into every password field — one known development value, so
   * the copy can be logged into. Computed by the caller through the app's own
   * crypto service rather than reimplemented here.
   */
  readonly devPasswordHash: string;
  /** When true, count what would change and write nothing. */
  readonly dryRun: boolean;
}

interface ValueRow {
  readonly nodeId: number;
  readonly value: unknown;
}

/** Field records reachable through one link name, live and soft-deleted alike. */
const readFieldValues = async (
  ctx: ScrubContext,
  link: string,
): Promise<ValueRow[]> =>
  await ctx.neo4j
    .query<ValueRow>(
      `MATCH ()-[:\`${link}\`]->(p)
       WHERE (p:Property OR p:Deleted_Property) AND p.value IS NOT NULL
       RETURN id(p) AS nodeId, p.value AS value`,
    )
    .run()
    .then((rows) => [...rows]);

const writeFieldValues = async (
  ctx: ScrubContext,
  updates: ReadonlyArray<{ nodeId: number; value: string | null }>,
): Promise<void> => {
  for (const batch of chunk([...updates], ctx.batchSize)) {
    await ctx.neo4j
      .query(
        `UNWIND $batch AS row
         MATCH (p) WHERE id(p) = row.nodeId
         SET p.value = row.value,
             p.sortValue = CASE WHEN p.sortValue IS NULL THEN NULL ELSE row.value END`,
        { batch: batch.map((row) => ({ ...row })) },
      )
      .run();
  }
};

const readNodeProperty = async (
  ctx: ScrubContext,
  key: string,
): Promise<ValueRow[]> =>
  await ctx.neo4j
    .query<ValueRow>(
      `MATCH (n) WHERE n.\`${key}\` IS NOT NULL
       RETURN id(n) AS nodeId, n.\`${key}\` AS value`,
    )
    .run()
    .then((rows) => [...rows]);

const writeNodeProperty = async (
  ctx: ScrubContext,
  key: string,
  updates: ReadonlyArray<{ nodeId: number; value: string | null }>,
): Promise<void> => {
  for (const batch of chunk([...updates], ctx.batchSize)) {
    await ctx.neo4j
      .query(
        `UNWIND $batch AS row
         MATCH (n) WHERE id(n) = row.nodeId
         SET n.\`${key}\` = row.value`,
        { batch: batch.map((row) => ({ ...row })) },
      )
      .run();
  }
};

/** Remove a key from every node and relationship carrying it. */
const deleteKeyEverywhere = async (
  ctx: ScrubContext,
  key: string,
): Promise<number> => {
  const nodes = await ctx.neo4j
    .query<{ affected: number }>(
      `MATCH (n) WHERE n.\`${key}\` IS NOT NULL
       ${ctx.dryRun ? '' : `REMOVE n.\`${key}\``}
       RETURN count(n) AS affected`,
    )
    .run();
  const rels = await ctx.neo4j
    .query<{ affected: number }>(
      `MATCH ()-[r]->() WHERE r.\`${key}\` IS NOT NULL
       ${ctx.dryRun ? '' : `REMOVE r.\`${key}\``}
       RETURN count(r) AS affected`,
    )
    .run();
  return Number(nodes[0]?.affected ?? 0) + Number(rels[0]?.affected ?? 0);
};

const isScrub = (
  action: Action,
): action is Extract<Action, { kind: 'scrub' }> => action.kind === 'scrub';

export interface ScrubReport {
  readonly scrubbedValues: number;
  readonly deletedKeys: number;
  readonly credentialsCleared: number;
  readonly perField: ReadonlyArray<{ field: string; replaced: number }>;
}

export const runScrub = async (ctx: ScrubContext): Promise<ScrubReport> => {
  // ── Guard ────────────────────────────────────────────────────────────────
  // Anything the live graph contains that this classification does not name is a
  // hard stop. The whole design rests on that: a field nobody classified is a
  // field nobody decided about, and defaulting it either way is wrong.
  const [liveLinks, liveKeys] = await Promise.all([
    ctx.neo4j
      .query<{ relationshipType: string }>(
        'CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType',
      )
      .run()
      .then((rows) => rows.map((row) => row.relationshipType)),
    ctx.neo4j
      .query<{ propertyKey: string }>(
        'CALL db.propertyKeys() YIELD propertyKey RETURN propertyKey',
      )
      .run()
      .then((rows) => rows.map((row) => row.propertyKey)),
  ]);

  // The marker's own fields are excluded — otherwise a scrubbed graph can never
  // be scrubbed again, because stamping it added keys nobody classified.
  const unclassified = findUnclassified(
    liveLinks,
    liveKeys.filter((key) => !MARKER_PROPERTY_KEYS.includes(key)),
  );
  const problems = [
    ...unclassified.links.map((name) => `link "${name}"`),
    ...unclassified.properties.map((name) => `field "${name}"`),
    ...unclassified.unresolvedReviews.map(
      (name) => `"${name}" is still marked for review`,
    ),
  ];
  if (problems.length > 0) {
    throw new Error(
      `Refusing to scrub — ${problems.length} unresolved item(s). Classify each ` +
        `in src/core/scrub/classification.ts, then re-run:\n  ` +
        problems.join('\n  '),
    );
  }
  ctx.log(
    `Classification covers all ${liveLinks.length} links and ${liveKeys.length} fields.\n`,
  );

  const perField: Array<{ field: string; replaced: number }> = [];
  let scrubbedValues = 0;
  let credentialsCleared = 0;

  // ── Pass 1: credentials ──────────────────────────────────────────────────
  ctx.log('Pass 1 — credentials');
  for (const [link, action] of Object.entries(links)) {
    if (!isScrub(action) || action.as !== 'credential') continue;
    const rows = await readFieldValues(ctx, link);
    // Passwords become one known dev hash so the copy is usable; every other
    // credential is emptied.
    const replacement = link === 'password' ? ctx.devPasswordHash : null;
    if (!ctx.dryRun && rows.length > 0) {
      await writeFieldValues(
        ctx,
        rows.map((row) => ({ nodeId: row.nodeId, value: replacement })),
      );
    }
    credentialsCleared += rows.length;
    perField.push({ field: `${link} (link)`, replaced: rows.length });
    ctx.log(
      `  ${link} (link): ${rows.length}${link === 'password' ? ' → dev password' : ' → emptied'}`,
    );
  }
  for (const [key, action] of Object.entries(properties)) {
    if (!isScrub(action) || action.as !== 'credential') continue;
    const rows = await readNodeProperty(ctx, key);
    if (!ctx.dryRun && rows.length > 0) {
      await writeNodeProperty(
        ctx,
        key,
        rows.map((row) => ({ nodeId: row.nodeId, value: null })),
      );
    }
    credentialsCleared += rows.length;
    perField.push({ field: `${key} (field)`, replaced: rows.length });
    ctx.log(`  ${key} (field): ${rows.length} → emptied`);
  }

  // ── Pass 2: dead keys ────────────────────────────────────────────────────
  ctx.log('\nPass 2 — dead keys removed');
  let deletedKeys = 0;
  for (const [key, action] of Object.entries(properties)) {
    if (action.kind !== 'delete') continue;
    const affected = await deleteKeyEverywhere(ctx, key);
    if (affected > 0) deletedKeys += affected;
    ctx.log(`  ${key} (field): ${affected}`);
  }

  // ── Pass 3: everything else ──────────────────────────────────────────────
  ctx.log('\nPass 3 — values replaced');
  for (const [link, action] of Object.entries(links)) {
    if (!isScrub(action) || action.as === 'credential') continue;
    const rows = await readFieldValues(ctx, link);
    if (rows.length === 0) {
      ctx.log(`  ${link} (link): 0`);
      continue;
    }
    const updates = rows.map((row) => ({
      nodeId: row.nodeId,
      value: fakeValue(action.as, row.value),
    }));
    if (!ctx.dryRun) await writeFieldValues(ctx, updates);
    scrubbedValues += updates.length;
    perField.push({ field: `${link} (link)`, replaced: updates.length });
    ctx.log(`  ${link} (link): ${updates.length} → ${action.as}`);
  }
  for (const [key, action] of Object.entries(properties)) {
    if (!isScrub(action) || action.as === 'credential') continue;
    const rows = await readNodeProperty(ctx, key);
    if (rows.length === 0) {
      ctx.log(`  ${key} (field): 0`);
      continue;
    }
    const updates = rows.map((row) => ({
      nodeId: row.nodeId,
      value: fakeValue(action.as, row.value),
    }));
    if (!ctx.dryRun) await writeNodeProperty(ctx, key, updates);
    scrubbedValues += updates.length;
    perField.push({ field: `${key} (field)`, replaced: updates.length });
    ctx.log(`  ${key} (field): ${updates.length} → ${action.as}`);
  }

  // `sortValueFor` is referenced so the derived-key rule stays visible to anyone
  // editing the write helpers; the SET clause above applies it inline.
  void sortValueFor;

  if (!ctx.dryRun) {
    await stampProvenance(ctx.neo4j, {
      scrubbedValues,
      deletedKeys,
      at: new Date().toISOString(),
    });
  }

  return { scrubbedValues, deletedKeys, credentialsCleared, perField };
};
