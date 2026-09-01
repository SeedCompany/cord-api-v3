import { seedFor } from './fake';

/**
 * Project names: swap the words, keep the family.
 *
 * ## Why this is not just another pool
 *
 * Real project names form **prefix families** — "Mudi", "Mudi 2", "Mudi 3" are
 * one cluster of work. The generic `entityName` strategy shattered them: each
 * became an unrelated company name with a hex tag, scattered across the
 * alphabet. That silently deleted coverage for two things this migration
 * actively measures — adjacency under the custom `display_order` collation, and
 * the `pg_trgm` ILIKE search ported to Postgres. A prefix-ordering or
 * search-ranking difference between the engines would be invisible on scattered
 * names and obvious on family-structured ones.
 *
 * So: split the name into base + ordinal, replace the base, carry the ordinal
 * through untouched. "Mudi 2" becomes "Hyrule Basin 2", and its siblings become
 * "Hyrule Basin 3" and so on, because they share a base and the mapping is a
 * function of that base.
 *
 * The ordinal is safe to keep — it is a small integer carrying nothing personal,
 * and the family structure it encodes is the thing worth preserving.
 *
 * ## Why a registry rather than a hash
 *
 * `projects.name` is UNIQUE. The old strategy guaranteed that by appending 40
 * bits of the value's digest; dropping the tag to get readable names drops the
 * guarantee with it, and a collision **aborts the load** — this has happened
 * before over a null name. Hashing bases into a pool collides by the birthday
 * bound, so the assignment is made once, up front, with collisions resolved by
 * walking forward. See {@link buildProjectRegistry}.
 *
 * ⚠ Identical inputs still produce identical outputs, so genuinely duplicated
 * project names stay duplicated. That is deliberate and the opposite of the
 * decision taken for people's names — a duplicate project name is a finding the
 * migration measures, and `entityName`'s contract has always been to preserve
 * it.
 */

/** Which shape an ordinal arrived in. Reported, never assumed. */
export type OrdinalShape =
  | 'none'
  | 'space-digits'
  | 'hyphen-digits'
  | 'space-roman'
  | 'parenthesized';

export interface SplitName {
  readonly base: string;
  /** Everything after the base, verbatim — separator included. */
  readonly ordinal: string;
  readonly shape: OrdinalShape;
}

/**
 * Split a project name into the part to replace and the part to carry through.
 *
 * **Self-reporting on purpose.** We could not measure which separator real names
 * use before writing this: the only production copy had already been scrubbed,
 * so the evidence was gone. Rather than guess one, this recognizes every
 * plausible shape and reports which it matched, and the scrub prints the
 * distribution — so the next run tells us what the data actually looks like
 * instead of us assuming.
 *
 * ⚠ A trailing number is not necessarily an ordinal. "Mudi 2030" could be a
 * year, and nothing here can tell the difference. Carrying it through unchanged
 * is the safe failure: the worst case is that a number which was part of the
 * name survives as part of the name, and a bare integer carries nothing
 * protected.
 */
export const splitOrdinal = (name: string): SplitName => {
  const patterns: ReadonlyArray<[RegExp, OrdinalShape]> = [
    // Order matters: the parenthesized and hyphenated forms would also satisfy
    // a looser trailing-digits match, so they are tried first.
    [/^(.*?)(\s*\(\d+\))$/, 'parenthesized'],
    [/^(.*?)(\s*-\s*\d+)$/, 'hyphen-digits'],
    [/^(.*?)(\s+\d+)$/, 'space-digits'],
    [/^(.*?)(\s+[IVX]{1,4})$/, 'space-roman'],
  ];
  for (const [pattern, shape] of patterns) {
    const match = pattern.exec(name);
    // A base that trims to nothing means the whole value was an ordinal, which
    // is not a family — treat it as an unsplittable name.
    if (match?.[1]?.trim()) {
      return { base: match[1], ordinal: match[2]!, shape };
    }
  }
  return { base: name, ordinal: '', shape: 'none' };
};

/**
 * Assign every distinct base a distinct pool entry.
 *
 * Deterministic in three ways that all matter:
 *  - **Seeded from the base's own digest**, so a base keeps its title across
 *    monthly refreshes.
 *  - **Collisions walk FORWARD from that seed**, so adding a project next month
 *    perturbs at most its collision partners rather than reshuffling everyone.
 *  - **Bases are processed in sorted order**, so the result does not depend on
 *    the order rows came back from the database.
 *
 * Throws rather than falling back to a suffix if the pool cannot cover the
 * bases: a silent numeric suffix is exactly the unreadable output this work
 * exists to remove, and the caller should widen the pool instead.
 */
export const buildProjectRegistry = (
  bases: Iterable<string>,
  pool: readonly string[],
): ReadonlyMap<string, string> => {
  const distinct = [...new Set(bases)].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  if (distinct.length > pool.length) {
    throw new Error(
      `Project title pool too small: ${distinct.length} distinct name bases ` +
        `but only ${pool.length} titles. Widen PROJECT_TITLES in theme.ts — do ` +
        `not add a numeric suffix, which is the unreadable output this replaces.`,
    );
  }
  const taken = new Set<string>();
  const assigned = new Map<string, string>();
  for (const base of distinct) {
    const start = seedFor('projectName', base) % pool.length;
    // Walks the whole pool at most once; `keys()` is just the index range.
    for (const step of pool.keys()) {
      const candidate = pool[(start + step) % pool.length]!;
      if (!taken.has(candidate)) {
        taken.add(candidate);
        assigned.set(base, candidate);
        break;
      }
    }
  }
  return assigned;
};

/**
 * Replace the base, keep the ordinal. Unknown bases throw — the registry is
 * built from a full pass over the same field, so a miss means the two passes
 * disagreed and the result would silently be an unscrubbed name.
 */
export const composeProjectName = (
  registry: ReadonlyMap<string, string>,
  name: string,
): string => {
  const { base, ordinal } = splitOrdinal(name);
  const title = registry.get(base);
  if (title === undefined) {
    throw new Error(
      `No title assigned for a project name base seen during the write pass. ` +
        `The registry is built from a full read of the same field, so this means ` +
        `the passes disagreed — refusing rather than leaving a real name in place.`,
    );
  }
  return title + ordinal;
};

/** Counts per ordinal shape, for the census the scrub prints. */
export type ShapeCensus = Record<OrdinalShape, number>;

export const emptyCensus = (): ShapeCensus => ({
  none: 0,
  'space-digits': 0,
  'hyphen-digits': 0,
  'space-roman': 0,
  parenthesized: 0,
});
