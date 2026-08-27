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
 * Datetime canonicalization is limited to values that BOTH parse as ISO
 * moments AND represent the same instant — i.e. only string-form differences
 * (offset spelling, milliseconds) are treated as equal, and counted. A
 * date-only string counts as midnight UTC: legacy rows stored dates in
 * DateTime fields, and the engines serialize that back differently
 * (`2013-09-30` vs `2013-09-29T20:00:00-04:00` — the same instant; A1 triage
 * 2026-08-27). Anything else (different instants, null-vs-value) diffs as
 * usual.
 */
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const instantOf = (value: unknown): number | null =>
  typeof value === 'string' &&
  (ISO_INSTANT.test(value) || ISO_DATE_ONLY.test(value))
    ? Date.parse(value)
    : null;

const equivalentInstants = (a: unknown, b: unknown): boolean => {
  const parsedA = instantOf(a);
  return parsedA !== null && parsedA === instantOf(b);
};

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
 * The key that identifies an array element for order-independent alignment,
 * tried in this order:
 * - `id` covers nearly every list in the corpus;
 * - `product.id` (+ `variant.key`) covers ProgressReport.progress — one entry
 *   PER PRODUCT, so `variant.key` alone duplicates ("official" × 49);
 * - `variant.key` covers variant arrays without a product;
 * - `step` covers the step arrays inside progress entries;
 * - `partnership.id` + `medium` covers partnershipsProducingMediums.
 * Items with none of these (or duplicate keys within one array) fall back to
 * the index-wise walk.
 */
const alignmentKeyOf = (item: unknown): string | null => {
  if (!isPlainObject(item)) return null;
  if (typeof item.id === 'string') return `id=${item.id}`;
  const variant = item.variant;
  const variantKey =
    isPlainObject(variant) && typeof variant.key === 'string'
      ? variant.key
      : null;
  const product = item.product;
  if (isPlainObject(product) && typeof product.id === 'string') {
    return `product=${product.id}${variantKey ? `|variant=${variantKey}` : ''}`;
  }
  if (variantKey) return `variant=${variantKey}`;
  if (typeof item.step === 'string') return `step=${item.step}`;
  const partnership = item.partnership;
  if (
    isPlainObject(partnership) &&
    typeof partnership.id === 'string' &&
    typeof item.medium === 'string'
  ) {
    return `partnership=${partnership.id}|medium=${item.medium}`;
  }
  return null;
};

/** Per-item keys, or null unless EVERY item is keyable and keys are unique. */
const alignmentKeys = (items: readonly unknown[]): string[] | null => {
  const keys: string[] = [];
  for (const item of items) {
    const key = alignmentKeyOf(item);
    if (key === null) return null;
    keys.push(key);
  }
  return new Set(keys).size === keys.length ? keys : null;
};

/**
 * Structural walk of two JSON values, emitting leaf differences.
 *
 * Arrays whose items all carry an alignment key are matched BY KEY, not by
 * index: legacy bulk imports share createdAt timestamps, the engines break
 * the ties differently, and an index-wise walk turns a reorder into phantom
 * missing data (the progress[0]↔progress[7] mirror from the A1 triage —
 * 3,461 entries whose dominant class was exactly this). Ordering is still
 * signal, but it surfaces as ONE `«order»` entry comparing the shared-key
 * sequences instead of thousands of misaligned leaf diffs. Unkeyable arrays
 * keep the index-wise walk, where order differences diff leaf-by-leaf.
 */
const walk = (a: unknown, b: unknown, path: string, state: WalkState): void => {
  if (Object.is(a, b)) return;
  if (equivalentInstants(a, b)) {
    state.instantNormalized += 1;
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const keysA = alignmentKeys(a);
    const keysB = keysA ? alignmentKeys(b) : null;
    if (keysA && keysB) {
      const byKeyB = new Map(keysB.map((key, i) => [key, b[i]]));
      const setA = new Set(keysA);
      const sharedA = keysA.filter((key) => byKeyB.has(key));
      const sharedB = keysB.filter((key) => setA.has(key));
      if (sharedA.join('\n') !== sharedB.join('\n')) {
        state.diffs.push({
          path: `${path}.«order»`,
          neo4j: sharedA,
          postgres: sharedB,
        });
      }
      keysA.forEach((key, i) => {
        walk(
          a[i],
          byKeyB.has(key) ? byKeyB.get(key) : ABSENT,
          `${path}[${key}]`,
          state,
        );
      });
      keysB.forEach((key, i) => {
        if (!setA.has(key)) walk(ABSENT, b[i], `${path}[${key}]`, state);
      });
      return;
    }
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
