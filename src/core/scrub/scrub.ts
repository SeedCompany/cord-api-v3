import { chunk } from 'lodash';
import { type DatabaseService } from '~/core/neo4j';
import {
  type Action,
  baseLabel,
  findUnclassified,
  isFieldRecord,
  links,
  nameStrategyByLabel,
  properties,
} from './classification';
import { fakeValue, sortValueFor } from './fake';
import {
  buildProjectRegistry,
  composeProjectName,
  emptyCensus,
  type ShapeCensus,
  splitOrdinal,
} from './project-name';
import {
  MARKER_PROPERTY_KEYS,
  readProvenance,
  stampProvenance,
} from './provenance';
import { PROJECT_TITLES } from './theme';

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
  /**
   * Id of the record the field hangs off — the User behind a `realFirstName`,
   * say. Read so the per-record strategies can key on it; see
   * `PER_RECORD_STRATEGIES` in `fake.ts` for why person names need it.
   *
   * `coalesce(n.id, n.deleted_id)` because a soft-deleted record carries its id
   * under the prefixed name, and its field versions still have to be scrubbed.
   * Null for the node-property pass, where the value already lives ON the record
   * and no per-record strategy applies to it.
   */
  readonly ownerId: string | null;
  /**
   * Labels of that record, so a polymorphic link can be themed per record type.
   * See `nameStrategyByLabel` — `name` alone is shared by ten kinds of record.
   */
  readonly labels: readonly string[];
}

/**
 * Page through matching rows, handing each page to `handle` before reading the
 * next. Returns the total number of rows processed.
 *
 * PAGINATED BY NODE ID, not SKIP/LIMIT, and the difference is correctness rather
 * than taste. The match predicate includes `value IS NOT NULL`, and the credential
 * pass sets values TO null — so rows leave the result set as we work, and every
 * subsequent SKIP would step over rows that were never processed. Seeking on
 * `id(p) > $after` is immune: ids don't change, so a page boundary means the same
 * thing before and after a write.
 *
 * It also bounds memory to one page. The first version read a whole field's rows
 * up front, which was fine against the 21,110 values a local graph holds and
 * would not have been against the millions a production copy does — `name` alone
 * spans every named record in the system.
 */
const forEachPage = async (
  ctx: ScrubContext,
  buildQuery: (
    after: number,
    pageSize: number,
  ) => readonly [cypher: string, params: object],
  handle: (rows: readonly ValueRow[]) => Promise<void>,
): Promise<number> => {
  // Inlined into the Cypher rather than bound as a parameter: LIMIT demands an
  // integer, and the driver serializes a JS number as a float ('1000.0 is not a
  // valid value'). Safe to interpolate because it is validated as an integer
  // here and never comes from user input.
  const pageSize = Math.trunc(ctx.batchSize);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error(
      `Batch size must be a positive integer (got ${ctx.batchSize})`,
    );
  }
  let after = -1;
  let total = 0;
  let page = 0;
  // A short page means the end — so a field that fits in one page costs one query
  // rather than two, which matters across 40-odd fields.
  do {
    const [cypher, params] = buildQuery(after, pageSize);
    const rows = [...(await ctx.neo4j.query<ValueRow>(cypher, params).run())];
    page = rows.length;
    if (page > 0) {
      await handle(rows);
      total += page;
      after = rows[page - 1]!.nodeId;
    }
  } while (page === pageSize);
  return total;
};

/** Field records reachable through one link name, live and soft-deleted alike. */
const eachFieldValuePage = async (
  ctx: ScrubContext,
  link: string,
  handle: (rows: readonly ValueRow[]) => Promise<void>,
): Promise<number> =>
  await forEachPage(
    ctx,
    (after, pageSize) => [
      `MATCH (n)-[:\`${link}\`]->(p)
       WHERE ${isFieldRecord('p')} AND p.value IS NOT NULL
         AND id(p) > $after
       RETURN id(p) AS nodeId, p.value AS value,
              coalesce(n.id, n.deleted_id) AS ownerId, labels(n) AS labels
       ORDER BY id(p) LIMIT ${pageSize}`,
      { after },
    ],
    handle,
  );

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

const eachNodePropertyPage = async (
  ctx: ScrubContext,
  key: string,
  handle: (rows: readonly ValueRow[]) => Promise<void>,
): Promise<number> =>
  await forEachPage(
    ctx,
    (after, pageSize) => [
      `MATCH (n) WHERE n.\`${key}\` IS NOT NULL AND id(n) > $after
       RETURN id(n) AS nodeId, n.\`${key}\` AS value, null AS ownerId,
              labels(n) AS labels
       ORDER BY id(n) LIMIT ${pageSize}`,
      { after },
    ],
    handle,
  );

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

/**
 * Does this row's record get the project-name treatment?
 *
 * ⚠ Compares STRIPPED labels. A soft-deleted project is `:Deleted_Project` and
 * a twice-deleted one `:Deleted_Deleted_Project`, so a `=== 'Project'` test
 * would skip exactly the historical rows the scrub exists to cover.
 */
const isProjectRow = (row: ValueRow) =>
  row.labels.some(
    (label) => nameStrategyByLabel[baseLabel(label)] === 'projectName',
  );

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

  // ── A re-scrub DEGRADES the copy, so say so before doing one ──────────────
  //
  // Every generator is a pure function of the value it replaces, so a second
  // pass reads the FIRST pass's output. Its input domain is therefore whatever
  // the last run produced, and distinctness can only shrink from there —
  // hashing N distinct values into a pool of P slots leaves about
  // P(1 - e^(-N/P)) of them in use, never more than N.
  //
  // Measured on the production copy 2026-09-01, and the reason this warning
  // exists: growing the surname pool 150 -> 242 and re-scrubbing took surnames
  // IN USE from 149 down to 101, and duplicate full names from 140 up to 240.
  // The same pool scrubbing real names fills 241 of 242 slots. So a pool or
  // strategy change CANNOT be evaluated or realized on an already-scrubbed
  // graph — it needs a fresh restore. The warning is here in the harness rather
  // than in the entry script for the same reason `checkScrubGate` is: an
  // entry-point check is bypassed by every other caller.
  //
  // Credentials and dead keys are unaffected — emptying and removing are
  // idempotent. It is only the generated VALUES that decay.
  const existing = await readProvenance(ctx.neo4j);
  if (existing) {
    ctx.log(
      `⚠ ALREADY SCRUBBED ${existing.scrubbedAt} (classification ` +
        `${existing.classificationHash}, ${existing.scrubbedValues} values).\n` +
        `  Re-scrubbing replaces fakes with fakes OF fakes, and distinctness\n` +
        `  only shrinks: names collapse onto fewer pool entries every pass, so\n` +
        `  duplicate people and duplicate project names INCREASE.\n` +
        `  If you changed a pool or a strategy, restore a fresh copy and scrub\n` +
        `  that instead — this run cannot show you what the change really does.\n`,
    );
  }

  const perField: Array<{ field: string; replaced: number }> = [];
  let scrubbedValues = 0;
  let credentialsCleared = 0;

  // ── Pass 1: credentials ──────────────────────────────────────────────────
  ctx.log('Pass 1 — credentials');
  for (const [link, action] of Object.entries(links)) {
    if (!isScrub(action) || action.as !== 'credential') continue;
    // Passwords become one known dev hash so the copy is usable; every other
    // credential is emptied.
    const replacement = link === 'password' ? ctx.devPasswordHash : null;
    const count = await eachFieldValuePage(ctx, link, async (rows) => {
      if (ctx.dryRun) return;
      await writeFieldValues(
        ctx,
        rows.map((row) => ({ nodeId: row.nodeId, value: replacement })),
      );
    });
    credentialsCleared += count;
    perField.push({ field: `${link} (link)`, replaced: count });
    ctx.log(
      `  ${link} (link): ${count}${link === 'password' ? ' → dev password' : ' → emptied'}`,
    );
  }
  for (const [key, action] of Object.entries(properties)) {
    if (!isScrub(action) || action.as !== 'credential') continue;
    const count = await eachNodePropertyPage(ctx, key, async (rows) => {
      if (ctx.dryRun) return;
      await writeNodeProperty(
        ctx,
        key,
        rows.map((row) => ({ nodeId: row.nodeId, value: null })),
      );
    });
    credentialsCleared += count;
    perField.push({ field: `${key} (field)`, replaced: count });
    ctx.log(`  ${key} (field): ${count} → emptied`);
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

  // ── Pass 2b: the project-title registry ──────────────────────────────────
  //
  // A read-only pass over the `name` link, collecting the distinct BASES of
  // project names so each can be assigned a distinct title. It has to happen up
  // front and see everything: `projects.name` is UNIQUE, so the assignment
  // cannot be made one page at a time without risking two bases landing on one
  // title and aborting the load.
  //
  // Cheap despite reading the biggest field, because only Project rows are kept
  // — 5,284 of 1,670,911 values — and only their bases, deduplicated.
  ctx.log('\nPass 2b — project title registry');
  const projectBases = new Set<string>();
  const census: ShapeCensus = emptyCensus();
  await eachFieldValuePage(ctx, 'name', async (rows) => {
    for (const row of rows) {
      if (!isProjectRow(row)) continue;
      if (typeof row.value !== 'string') continue;
      const { base, shape } = splitOrdinal(row.value);
      projectBases.add(base);
      census[shape] += 1;
    }
  });
  const projectTitles = buildProjectRegistry(projectBases, PROJECT_TITLES);
  ctx.log(
    `  ${projectBases.size} distinct name bases → ${projectTitles.size} titles ` +
      `assigned from a pool of ${PROJECT_TITLES.length}`,
  );
  // The census the parser reports rather than us assuming: which separator real
  // project names actually use. Written down because the previous copy was
  // already scrubbed when the question was first asked, so it was unanswerable.
  ctx.log(
    '  ordinal shapes: ' +
      Object.entries(census)
        .map(([shape, n]) => `${shape}=${n}`)
        .join(' · '),
  );

  // ── Pass 3: everything else ──────────────────────────────────────────────
  ctx.log('\nPass 3 — values replaced');
  for (const [link, action] of Object.entries(links)) {
    if (!isScrub(action) || action.as === 'credential') continue;
    const count = await eachFieldValuePage(ctx, link, async (rows) => {
      const updates = rows.map((row) => ({
        nodeId: row.nodeId,
        // Three different keying rules meet here, so the row decides:
        //  - a Project's `name` goes through the registry, to keep its family
        //    and its uniqueness (see project-name.ts);
        //  - person names key on ownerId, so two people who share a real name
        //    get different fakes;
        //  - everything else keys on the value alone, preserving the collisions
        //    production has.
        value:
          isProjectRow(row) && typeof row.value === 'string'
            ? composeProjectName(projectTitles, row.value)
            : fakeValue(action.as, row.value, row.ownerId),
      }));
      if (!ctx.dryRun) await writeFieldValues(ctx, updates);
    });
    scrubbedValues += count;
    if (count > 0) {
      perField.push({ field: `${link} (link)`, replaced: count });
    }
    ctx.log(`  ${link} (link): ${count}${count ? ` → ${action.as}` : ''}`);
  }
  for (const [key, action] of Object.entries(properties)) {
    if (!isScrub(action) || action.as === 'credential') continue;
    const count = await eachNodePropertyPage(ctx, key, async (rows) => {
      const updates = rows.map((row) => ({
        nodeId: row.nodeId,
        value: fakeValue(action.as, row.value),
      }));
      if (!ctx.dryRun) await writeNodeProperty(ctx, key, updates);
    });
    scrubbedValues += count;
    if (count > 0) {
      perField.push({ field: `${key} (field)`, replaced: count });
    }
    ctx.log(`  ${key} (field): ${count}${count ? ` → ${action.as}` : ''}`);
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
