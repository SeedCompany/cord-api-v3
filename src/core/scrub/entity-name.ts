import { extname } from 'node:path';
import { type ThemedNameStrategy } from './classification';
import { seedFor } from './hash';
import {
  DIRECTORY_NAMES,
  FIELD_REGION_NAMES,
  FIELD_ZONE_NAMES,
  FILE_NAMES,
  FUNDING_ACCOUNT_NAMES,
  LANGUAGE_NAMES,
  LOCATION_NAMES,
  ORGANIZATION_NAMES,
  PRODUCIBLE_NAMES,
  PROJECT_TITLES,
  TOOL_NAMES,
} from './theme';

/**
 * Entity names: swap the words, keep the family, keep the uniqueness.
 *
 * Lifted from the Neo4j-era scrubber. The only thing that changed is HOW a
 * value is routed to a strategy: Neo4j routed on a record's labels, Postgres
 * routes on the table (and, for `file_nodes` and `producibles`, the `type`
 * column) — see `classification.ts`. Everything below that line is unchanged,
 * and `entity-name.spec.ts` pins the assignments so a refresh keeps its names.
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
 * **Every name this module handles is UNIQUE in Postgres.** Verified against the
 * Drizzle schema, not assumed: `projects`, `organizations`, `locations`,
 * `tools`, `field_zones`, `field_regions` and `funding_accounts` each carry a
 * `*_name_active_unique` partial index. The old strategy satisfied that by
 * appending 40 bits of the value's digest; dropping the tag to get readable
 * names drops the guarantee with it, and a collision **aborts the load** — this
 * has happened before over a null name. Hashing bases into a pool collides by
 * the birthday bound, so the assignment is made once, up front, with collisions
 * resolved by walking forward. See {@link buildNameRegistry}.
 *
 * The indexes are PARTIAL (`WHERE deleted_at IS NULL`), so strictly only live
 * rows need distinct names. Keying the registry on the base rather than on
 * liveness is deliberately stricter: a live row and a soft-deleted one sharing a
 * base still land on one title, which the partial index permits, and two
 * distinct live bases can never collide. Nothing has to know which rows are
 * deleted.
 *
 * ## Why this generalized past projects
 *
 * Projects were first, not special. When the remaining six entity names turned
 * out to carry the same constraint, the choice was one mechanism keyed by
 * strategy or six near-copies — and the concern really is one concern: *a
 * unique, human-readable name that keeps whatever ordinal family it had*. The
 * per-type differences live entirely in {@link NAME_POOLS}.
 *
 * ⚠ Identical inputs still produce identical outputs, so genuinely duplicated
 * names stay duplicated. That is deliberate and the opposite of the decision
 * taken for people's names — a duplicate entity name is a finding the migration
 * measures, and `entityName`'s contract has always been to preserve it.
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
 * The pool each themed strategy draws from.
 *
 * Exhaustive over {@link ThemedNameStrategy} by its type, so adding a strategy
 * without giving it a pool does not compile — the failure mode this replaces was
 * a strategy silently resolving to `undefined` and taking the whole registry
 * build down at run time, on a copy already holding real data.
 */
export const NAME_POOLS: Readonly<
  Record<ThemedNameStrategy, readonly string[]>
> = {
  projectName: PROJECT_TITLES,
  organizationName: ORGANIZATION_NAMES,
  locationName: LOCATION_NAMES,
  fieldZoneName: FIELD_ZONE_NAMES,
  fieldRegionName: FIELD_REGION_NAMES,
  fundingAccountName: FUNDING_ACCOUNT_NAMES,
  toolName: TOOL_NAMES,
  // One shared vocabulary, three independent registries — uniqueness is per
  // type, so a Film and a Story may land on the same name.
  filmName: PRODUCIBLE_NAMES,
  storyName: PRODUCIBLE_NAMES,
  ethnoArtName: PRODUCIBLE_NAMES,
  // Hash-assigned from one pool shared with the `displayName` link's strategy of
  // the same name — see the LANGUAGE NAMES block in `theme.ts`.
  languageName: LANGUAGE_NAMES,
  fileName: FILE_NAMES,
  directoryName: DIRECTORY_NAMES,
};

/**
 * Which strategies get a registry, and which are assigned by hash.
 *
 * **The split follows the database, not convenience.** A registry exists to
 * guarantee distinctness, and it is needed exactly where a UNIQUE index would
 * abort a load: `projects`, `organizations`, `locations`, `tools`, `field_zones`,
 * `field_regions`, `funding_accounts`, and the three producibles per type. File
 * nodes carry no such index — their one uniqueness rule is per-directory and
 * lives in `file.service.ts` — so they are hashed, which is what keeps a
 * 1.6-million-row field from needing a registry held in memory for the whole
 * scrub. See the FILE AND DIRECTORY NAMES block in `theme.ts` for the collision
 * arithmetic that makes hashing sound there and unsound here.
 *
 * ⚠ **Corroborated by a second, independent source.** The list above was derived
 * from the Drizzle schema; Neo4j's `@DbUnique` decorators declare the same set
 * per property label — Organization (`OrgName`), Tool, Location, Project,
 * FieldRegion, FieldZone, FundingAccount, and Film/Story/EthnoArt separately —
 * and neither file names nor language names appear on it. Two checks that could
 * have disagreed about which names are constrained, and did not.
 *
 * ⚠ A registry strategy may only be applied to the column its registry was
 * read from. The hash strategies have no such restriction.
 */
export const REGISTRY_STRATEGIES: ReadonlySet<ThemedNameStrategy> = new Set([
  'projectName',
  'organizationName',
  'locationName',
  'fieldZoneName',
  'fieldRegionName',
  'fundingAccountName',
  'toolName',
  'filmName',
  'storyName',
  'ethnoArtName',
]);

export const usesRegistry = (strategy: ThemedNameStrategy): boolean =>
  REGISTRY_STRATEGIES.has(strategy);

/**
 * Split a name into the part to replace and the part to carry through.
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
 *  - **Seeded from the base's own digest**, so a base keeps its name across
 *    monthly refreshes.
 *  - **Collisions walk FORWARD from that seed**, so adding a record next month
 *    perturbs at most its collision partners rather than reshuffling everyone.
 *  - **Bases are processed in sorted order**, so the result does not depend on
 *    the order rows came back from the database.
 *
 * ⚠ The strategy name is part of the seed, so each type assigns independently
 * and — because projects kept the strategy name `projectName` and the pool
 * `PROJECT_TITLES` — **every project assignment made before this generalized is
 * reproduced exactly.** `entity-name.spec.ts` pins that rather than trusting it.
 *
 * Callers should size pools through {@link findPoolShortfalls} first; this still
 * throws if asked to do the impossible, because a silent numeric suffix is
 * exactly the unreadable output this work exists to remove.
 */
export const buildNameRegistry = (
  strategy: ThemedNameStrategy,
  bases: Iterable<string>,
  pool: readonly string[] = NAME_POOLS[strategy],
): ReadonlyMap<string, string> => {
  const distinct = [...new Set(bases)].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  if (distinct.length > pool.length) {
    throw new Error(
      `Pool for '${strategy}' too small: ${distinct.length} distinct name ` +
        `bases but only ${pool.length} entries. Widen it in theme.ts — do not ` +
        `add a numeric suffix, which is the unreadable output this replaces.`,
    );
  }
  const taken = new Set<string>();
  const assigned = new Map<string, string>();
  for (const base of distinct) {
    const start = seedFor(strategy, base) % pool.length;
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

export interface PoolShortfall {
  readonly strategy: ThemedNameStrategy;
  readonly distinctBases: number;
  readonly poolSize: number;
}

/**
 * Every pool that cannot cover what was read, reported together.
 *
 * Deliberately not "throw on the first one". A pool shortfall is discovered
 * partway through a scrub of a **freshly restored copy**, which at that moment
 * holds real production data — so the run has to be repeated after widening, and
 * repeating it costs a restore. Learning about all six shortfalls at once is the
 * difference between one more restore and six. Same reasoning as
 * `findUnclassified` reporting the whole list.
 */
export const findPoolShortfalls = (
  basesByStrategy: ReadonlyMap<ThemedNameStrategy, ReadonlySet<string>>,
): readonly PoolShortfall[] =>
  [...basesByStrategy]
    .filter(([strategy, bases]) => bases.size > NAME_POOLS[strategy].length)
    .map(([strategy, bases]) => ({
      strategy,
      distinctBases: bases.size,
      poolSize: NAME_POOLS[strategy].length,
    }));

/**
 * Replace the base, keep the ordinal. Unknown bases throw — the registry is
 * built from a full pass over the same field, so a miss means the two passes
 * disagreed and the result would silently be an unscrubbed name.
 */
export const composeThemedName = (
  registry: ReadonlyMap<string, string>,
  name: string,
): string => {
  const { base, ordinal } = splitOrdinal(name);
  const themed = registry.get(base);
  if (themed === undefined) {
    throw new Error(
      `No themed name assigned for a name base seen during the write pass. ` +
        `The registry is built from a full read of the same field, so this means ` +
        `the passes disagreed — refusing rather than leaving a real name in place.`,
    );
  }
  return themed + ordinal;
};

/**
 * Split a file name into the part to replace and the extension to keep.
 *
 * Delegates to node's own `extname` rather than reimplementing it, because
 * `file.service.ts:165` calls exactly that function to decide what a download is
 * called — so any divergence here would rename files on their way out. It also
 * inherits the edge cases for free: `.hidden` has no extension, `a.tar.gz` ends
 * in `.gz`, `noext` yields an empty string.
 */
export const splitExtension = (
  name: string,
): { readonly stem: string; readonly extension: string } => {
  const extension = extname(name);
  return { stem: name.slice(0, name.length - extension.length), extension };
};

/**
 * Which strategies carry a file extension — **only files**.
 *
 * ⚠ Narrower than "the hash strategies", and the difference is a real bug rather
 * than a nicety. `extname` finds the last dot anywhere in the name, so it
 * happily reports an "extension" for anything with a dot in it: a language
 * called `St. Mark` splits to a stem of `St` and an extension of `. Mark`, and a
 * directory called `Rev 1.2` splits to `Rev 1` + `.2`. Only a File (and its
 * versions) actually stores `stem + extension`, and only there does
 * `file.service.ts` read one back out.
 *
 * Directories are excluded deliberately: Postgres even asserts they have no mime
 * type, and they have no extension either.
 */
const EXTENSION_BEARING: ReadonlySet<ThemedNameStrategy> = new Set([
  'fileName',
]);

/**
 * A hash-assigned themed name.
 *
 * For a file, the stem is replaced and the extension carried through. Keyed on
 * the STEM rather than the whole name, so `Report.pdf` and `Report.docx` become
 * the same stem with different extensions — which is what the original pair
 * looked like, and what a person scanning a folder expects.
 *
 * For everything else the whole value is the key, which is what preserves a real
 * relationship in the language fields: production usually stores the same string
 * in `name` and `displayName`, and one pool keyed on the value reproduces that
 * equality instead of inventing a distinct public alias for every language.
 *
 * ⚠ **A leading dot is carried through, and `extname` is why that needs saying.**
 * Node treats a dotfile as having no extension at all — `extname('.gitkeep')` is
 * `''`, so the stem comes back as the whole `.gitkeep`. A first attempt here
 * guarded on an empty stem, which therefore never fired, and the dot was
 * replaced along with the rest: a hidden file became a visible one. Preserving it
 * explicitly is the fix, and `.env.local` (stem `.env`, extension `.local`)
 * exercises both halves at once.
 */
export const composeHashedName = (
  strategy: ThemedNameStrategy,
  name: string,
): string => {
  const pool = NAME_POOLS[strategy];
  if (!EXTENSION_BEARING.has(strategy)) {
    return pool[seedFor(strategy, name) % pool.length]!;
  }
  const { stem, extension } = splitExtension(name);
  if (stem === '') return name;
  const themed = pool[seedFor(strategy, stem) % pool.length]!;
  return (name.startsWith('.') ? '.' : '') + themed + extension;
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
