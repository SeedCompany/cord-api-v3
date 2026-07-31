import { createHash } from 'node:crypto';
import { type DatabaseService } from '~/core/neo4j';
import { links, properties } from './classification';

/**
 * Data provenance marker, and the gate that reads it.
 *
 * The point of this file is that "the copy was scrubbed" stops being a promise
 * anybody has to remember and becomes something the tooling can check. Without
 * it, the safety story depends on nobody ever restoring a dump and then getting
 * distracted — which is exactly the failure that would matter most.
 *
 * TWO SIGNALS, because either one alone has a hole:
 *
 *  1. **The marker.** Written on a successful scrub. Precise, and records which
 *     classification produced it.
 *  2. **A size heuristic.** A graph far larger than any seeded local dataset is
 *     production-derived by definition. This is the backstop for the case the
 *     marker cannot cover: someone restores a dump and never runs anything, so
 *     there is no marker to be missing-or-present — just an unmarked graph that
 *     looks exactly like a fresh dev database.
 *
 * Heuristic first, then marker: a big graph with no marker is refused. A small
 * graph is assumed to be local test data and allowed, because requiring a marker
 * everywhere would mean retrofitting every existing dev workflow, and a gate
 * people have to disable to get work done is a gate that gets disabled.
 */

const MARKER_LABEL = 'DataProvenance';

/**
 * The marker's own property names.
 *
 * These have to be excluded from the classification guard, and finding out why
 * took a second run: stamping the marker introduces four new property names into
 * the graph's registry, so the very next scrub refuses to start on fields it
 * created itself. A graph could be scrubbed exactly once, ever.
 *
 * Kept here rather than added to the classification because that file is a review
 * artifact about the application's data. Mixing this tool's own bookkeeping into
 * it would mean a reviewer has to work out which entries are real.
 */
export const MARKER_PROPERTY_KEYS: readonly string[] = [
  'scrubbedAt',
  'classificationHash',
  'scrubbedValues',
  'deletedKeys',
];

/**
 * Above this node count, a graph is treated as production-derived.
 *
 * Calibration: production has ~5,264 projects and millions of field records;
 * local test data is a few dozen entities. Any threshold in between works, so
 * this is deliberately far above realistic seeded data and far below real. Uses
 * the count store, so it is O(1) regardless of graph size.
 */
const PROD_SCALE_NODE_COUNT = 100_000;

export interface Provenance {
  readonly scrubbedAt: string;
  readonly classificationHash: string;
  readonly scrubbedValues: number;
  readonly deletedKeys: number;
}

/**
 * Hash of the classification's DECISIONS. Recorded with the marker so a copy
 * scrubbed under older rules is identifiable after the rules change — "was this
 * scrubbed?" is a less useful question than "was it scrubbed under the rules we
 * have now?".
 *
 * Hashes the data, not the source file. Two reasons, the first learned the hard
 * way: reading the `.ts` alongside the module works in development and throws
 * once the code is compiled, because the module then lives in `dist/` where no
 * source file exists. The second is better semantics — reformatting or rewording
 * a comment should not invalidate every existing copy, while genuinely
 * reclassifying a field should.
 *
 * Sorted, so key order in the file cannot change the hash either.
 */
export const classificationHash = (): string => {
  const canonical = [
    ...Object.entries(links).map(([name, action]) => ['link', name, action]),
    ...Object.entries(properties).map(([name, action]) => [
      'field',
      name,
      action,
    ]),
  ]
    .map(
      ([scope, name, action]) =>
        `${scope as string}:${name as string}:${JSON.stringify(action)}`,
    )
    .sort((a, b) => a.localeCompare(b))
    .join('\n');
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
};

export const readProvenance = async (
  neo4j: DatabaseService,
): Promise<Provenance | undefined> => {
  const rows = await neo4j
    .query<{
      marker: Provenance;
    }>(`MATCH (n:\`${MARKER_LABEL}\`) RETURN properties(n) AS marker LIMIT 1`)
    .run();
  return rows[0]?.marker;
};

export const stampProvenance = async (
  neo4j: DatabaseService,
  stats: { scrubbedValues: number; deletedKeys: number; at: string },
): Promise<void> => {
  await neo4j
    .query(
      `MERGE (n:\`${MARKER_LABEL}\`)
       SET n.scrubbedAt = $at,
           n.classificationHash = $hash,
           n.scrubbedValues = $scrubbedValues,
           n.deletedKeys = $deletedKeys`,
      {
        at: stats.at,
        hash: classificationHash(),
        scrubbedValues: stats.scrubbedValues,
        deletedKeys: stats.deletedKeys,
      },
    )
    .run();
};

const nodeCount = async (neo4j: DatabaseService): Promise<number> => {
  const rows = await neo4j
    .query<{ total: number }>('MATCH (n) RETURN count(n) AS total')
    .run();
  return Number(rows[0]?.total ?? 0);
};

export interface GateResult {
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * Call before anything reads the graph in bulk — the copy harness and the parity
 * capture both qualify, because both persist what they read.
 *
 * Returns a result rather than throwing so the caller decides how loud to be, and
 * so the reason can be logged verbatim. A refusal names what to do about it;
 * a gate that only says "no" gets worked around.
 */
export const checkScrubGate = async (
  neo4j: DatabaseService,
): Promise<GateResult> => {
  const provenance = await readProvenance(neo4j);
  if (provenance) {
    const current = classificationHash();
    if (provenance.classificationHash !== current) {
      return {
        allowed: false,
        reason:
          `This graph was scrubbed under classification ${provenance.classificationHash}, ` +
          `but the current classification is ${current}. Fields may have been ` +
          `added or reclassified since. Re-run \`yarn scrub\` before using it.`,
      };
    }
    return {
      allowed: true,
      reason: `Scrubbed ${provenance.scrubbedAt} (${provenance.scrubbedValues} values replaced).`,
    };
  }

  const total = await nodeCount(neo4j);
  if (total >= PROD_SCALE_NODE_COUNT) {
    return {
      allowed: false,
      reason:
        `Refusing to read: ${total.toLocaleString()} nodes is production scale and ` +
        `there is no scrub marker. If this really is a production copy, run ` +
        `\`yarn scrub\` first. If it is genuinely test data at this size, stamp it ` +
        `deliberately rather than lowering this threshold.`,
    };
  }

  return {
    allowed: true,
    reason: `No marker, ${total.toLocaleString()} nodes — treated as local test data.`,
  };
};
