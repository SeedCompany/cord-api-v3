import { matchKnownDelta } from './known-deltas';
import {
  type CaptureFile,
  type DiffEntry,
  type DiffReport,
  type OperationResult,
  type OpPersonaSummary,
} from './types';

/**
 * Marker for a key/index present on one side but absent on the other.
 * Deliberately distinct from `null` — null-vs-missing is a real finding class
 * and is never normalized away.
 */
export const ABSENT = '«absent»';

/**
 * Datetime canonicalization is limited to values that are BOTH valid ISO
 * instants AND represent the same moment — i.e. only string-form differences
 * (offset spelling, milliseconds) are treated as equal, and counted. Anything
 * else (different instants, date-only strings, null-vs-value) diffs as usual.
 */
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const equivalentInstants = (a: unknown, b: unknown): boolean =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  ISO_INSTANT.test(a) &&
  ISO_INSTANT.test(b) &&
  Date.parse(a) === Date.parse(b);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Locale-independent, deterministic string ordering. */
const compareStrings = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

interface RawDiff {
  readonly path: string;
  readonly neo4j: unknown;
  readonly postgres: unknown;
}

interface WalkState {
  readonly diffs: RawDiff[];
  instantNormalized: number;
}

/**
 * Structural walk of two JSON values, emitting leaf differences.
 * List item ORDER matters: arrays are compared index-wise as-is —
 * ordering drift IS signal (see the disabled collation known-delta).
 */
const walk = (a: unknown, b: unknown, path: string, state: WalkState): void => {
  if (Object.is(a, b)) return;
  if (equivalentInstants(a, b)) {
    state.instantNormalized += 1;
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      state.diffs.push({
        path: `${path}.length`,
        neo4j: a.length,
        postgres: b.length,
      });
    }
    const len = Math.max(a.length, b.length);
    for (const i of Array.from({ length: len }).keys()) {
      walk(
        i < a.length ? a[i] : ABSENT,
        i < b.length ? b[i] : ABSENT,
        `${path}[${i}]`,
        state,
      );
    }
    return;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(
      compareStrings,
    );
    for (const key of keys) {
      walk(
        key in a ? a[key] : ABSENT,
        key in b ? b[key] : ABSENT,
        path ? `${path}.${key}` : key,
        state,
      );
    }
    return;
  }
  state.diffs.push({ path, neo4j: a, postgres: b });
};

const resultKey = (result: OperationResult) =>
  `${result.op}\0${result.persona}`;

/** Throws unless both captures resolved identical personas + sampled ids. */
const assertComparable = (neo4j: CaptureFile, postgres: CaptureFile): void => {
  const mismatches: string[] = [];
  const personasA = JSON.stringify(neo4j.meta.personas);
  const personasB = JSON.stringify(postgres.meta.personas);
  if (personasA !== personasB) {
    mismatches.push(
      `personas differ:\n  neo4j: ${personasA}\n  pg: ${personasB}`,
    );
  }
  const idsA = JSON.stringify(neo4j.meta.sampledIds);
  const idsB = JSON.stringify(postgres.meta.sampledIds);
  if (idsA !== idsB) {
    mismatches.push(`sampled ids differ:\n  neo4j: ${idsA}\n  pg: ${idsB}`);
  }
  if (mismatches.length > 0) {
    throw new Error(
      'Captures are not comparable — they were taken against different ' +
        'datasets (or the Postgres data changed between runs). Re-run both ' +
        `captures against the same loaded DBs.\n${mismatches.join('\n')}`,
    );
  }
};

export const diffCaptures = (
  neo4j: CaptureFile,
  postgres: CaptureFile,
): DiffReport => {
  assertComparable(neo4j, postgres);

  const neo4jByKey = new Map(neo4j.results.map((r) => [resultKey(r), r]));
  const postgresByKey = new Map(postgres.results.map((r) => [resultKey(r), r]));
  const allKeys = [
    ...new Set([...neo4jByKey.keys(), ...postgresByKey.keys()]),
  ].sort(compareStrings);

  const summaries: OpPersonaSummary[] = [];
  const diffs: DiffEntry[] = [];
  const suppressed: DiffEntry[] = [];
  let instantNormalized = 0;

  for (const key of allKeys) {
    const a = neo4jByKey.get(key);
    const b = postgresByKey.get(key);
    // Op/persona identity comes from whichever side has the result; a result
    // missing on one side (corpus drift between runs) diffs at the root.
    const known = (a ?? b)!;
    const state: WalkState = { diffs: [], instantNormalized: 0 };
    walk(
      a ? { data: a.data, errors: a.errors } : ABSENT,
      b ? { data: b.data, errors: b.errors } : ABSENT,
      '',
      state,
    );
    instantNormalized += state.instantNormalized;

    let unsuppressedCount = 0;
    let suppressedCount = 0;
    let errorsMismatch = false;
    for (const raw of state.diffs) {
      const rule = matchKnownDelta(known.op, known.persona, raw.path);
      const entry: DiffEntry = {
        op: known.op,
        persona: known.persona,
        ...raw,
        ...(rule ? { suppressedBy: rule.ref } : {}),
      };
      if (rule) {
        suppressed.push(entry);
        suppressedCount += 1;
      } else {
        diffs.push(entry);
        unsuppressedCount += 1;
        if (raw.path.startsWith('errors')) errorsMismatch = true;
      }
    }
    summaries.push({
      op: known.op,
      persona: known.persona,
      diffs: unsuppressedCount,
      suppressed: suppressedCount,
      errorsMismatch,
    });
  }

  const identical = summaries.filter(
    (s) => s.diffs === 0 && s.suppressed === 0,
  ).length;
  const withDiffs = summaries.filter((s) => s.diffs > 0).length;
  const withSuppressedOnly = summaries.filter(
    (s) => s.diffs === 0 && s.suppressed > 0,
  ).length;

  return {
    meta: {
      neo4j: neo4j.meta,
      postgres: postgres.meta,
      diffedAt: new Date().toISOString(),
    },
    summaries,
    diffs,
    suppressed,
    totals: {
      pairs: summaries.length,
      identical,
      withDiffs,
      withSuppressedOnly,
      diffCount: diffs.length,
      suppressedCount: suppressed.length,
      instantNormalized,
    },
  };
};
