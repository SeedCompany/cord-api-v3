import { faker } from '@faker-js/faker';
import { createHash } from 'node:crypto';
import { RichTextDocument } from '~/common';
import { type Strategy } from './classification';
import { GIVEN_NAMES, SURNAMES } from './theme';

/**
 * Deterministic replacement values.
 *
 * Every generator is a pure function of its inputs — (strategy, value), plus the
 * owning record's id for the per-record strategies. Two consequences, both
 * load-bearing:
 *
 *  - **Refreshes are stable.** The same person keeps the same fake name across
 *    monthly rebuilds, so a bookmark, screenshot or ticket from last month still
 *    points at something recognizable.
 *  - **Duplicates survive WHERE THEY MATTER.** Production contains projects
 *    sharing a name, and that duplication is a finding the migration test
 *    measures; identical inputs produce identical outputs, so the duplicate is
 *    preserved rather than accidentally resolved by the scrub.
 *    ⚠ Person names are the deliberate exception — they key on the record too,
 *    so two people who share a real name get different fakes. See
 *    {@link PER_RECORD_STRATEGIES} for the decision and what it trades away.
 *
 * The mirror of that: **distinct inputs produce distinct outputs**, guaranteed by
 * appending a hash suffix wherever the real value carried a uniqueness
 * constraint. A collision there would abort a load, so it is built in rather
 * than left to luck — 40 bits over a few thousand values is a ~1-in-100,000 risk,
 * against a birthday collision on plain generated names being near-certain.
 */

/**
 * 48 bits of the digest — deterministic, and inside the safe integer range.
 *
 * Exported as {@link seedFor} so the project-name registry seeds its assignments
 * the same way rather than growing a second, subtly different hash.
 */
const seedOf = (strategy: string, value: string): number =>
  parseInt(
    createHash('sha256')
      .update(`${strategy}\0${value}`)
      .digest('hex')
      .slice(0, 12),
    16,
  );

export { seedOf as seedFor };

/** Stable suffix that makes a generated value unique to its input. */
const tagOf = (value: string): string =>
  createHash('sha256').update(value).digest('hex').slice(0, 10);

const seeded = <T>(strategy: string, value: string, make: () => T): T => {
  faker.seed(seedOf(strategy, value));
  return make();
};

/**
 * Deterministic pick from a reviewed pool.
 *
 * Pools rather than faker for the name fields, because the pool is the thing a
 * person can review and veto — see `theme.ts`. Indexed by the same digest the
 * faker strategies seed from, so the determinism story is identical.
 */
const pick = (
  strategy: string,
  value: string,
  pool: readonly string[],
): string => pool[seedOf(strategy, value) % pool.length]!;

/**
 * Strategies keyed on the RECORD (owner id + value) rather than the value alone.
 *
 * DECIDED (Rob, 2026-09-01): a person's full name should be unique across the
 * dataset. That cannot come from a bigger pool, because keying on the value
 * alone means everyone who shares a real first name necessarily lands on the
 * same fake one — 480 -> 863 given names moved the average from 5.1 people per
 * name to 3.2 and left the clusters intact, since a common real first name is
 * still one input.
 *
 * Mixing the owner's id into the seed fixes both halves of that at once:
 *  - **Duplicate full names go away.** Two different people with the same real
 *    name now get different fakes.
 *  - **The mixture improves.** Users are spread across the pool independently
 *    instead of clumping wherever a common real name happened to hash.
 *
 * What it deliberately gives up, recorded so nobody reads it as an oversight:
 * the copy no longer shows that production has **68 sets of people sharing a
 * full name**. That is a real characteristic, and it is being traded for a dev
 * environment where a repeated name is a genuine signal rather than noise. The
 * cost is low precisely because nothing measures duplicate PEOPLE — the
 * duplicate-preservation rule in this file's header was always about entity
 * names, where a UNIQUE constraint makes it load-bearing.
 *
 * ⚠ Which is why entity, language and prose strategies are NOT in this set.
 * Project names must keep colliding exactly where production's do.
 *
 * ⚠ Not a uniqueness GUARANTEE. Hashing 2,375 records into 863 x 2,664
 * combinations still collides about once by chance; only a registry that checks
 * and walks forward makes it exact. Measured after the run rather than assumed.
 *
 * Refresh stability survives: an id is more stable than a name, so a person
 * keeps their fake across rebuilds even if their real name changes... and a
 * changed real name still changes the fake, because the value is in the seed
 * too. Version history is preserved for the same reason — each historical value
 * of one person's name remains its own input.
 */
const PER_RECORD_STRATEGIES: ReadonlySet<Strategy> = new Set([
  'givenName',
  'surname',
]);

/**
 * Seed input for one value: the record's own key where the strategy is
 * per-record, the bare value otherwise.
 */
const keyFor = (strategy: Strategy, value: string, ownerId: string | null) =>
  PER_RECORD_STRATEGIES.has(strategy) && ownerId
    ? `${ownerId}\0${value}`
    : value;

/**
 * Prose of comparable length — length matters because it drives rich-text
 * structure and column sizing, which is part of what a migration rehearsal is
 * measuring. Trimmed at a word boundary so the result reads as text.
 */
const proseLike = (value: string): string => {
  const target = value.length;
  return seeded('prose', value, () => {
    let out = '';
    while (out.length < target) {
      out += (out ? ' ' : '') + faker.lorem.sentence();
    }
    if (out.length <= target) return out;
    const cut = out.slice(0, target);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > target * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
  });
};

/**
 * Rich text keeps its document shape — same block count, same block types, same
 * ids — and only the words inside change. A reader of the copy sees a document
 * that behaves like the original; nothing of what was written survives.
 *
 * Returns the re-serialized string (NUL-prefixed), because that is the form the
 * database stores. Anything unparseable comes back as a plain prose replacement:
 * a value we cannot read is still a value we must not leave in place.
 */
const richTextLike = (original: unknown): string => {
  // Resolve to a document object, from whichever of the three shapes arrived.
  //
  // THE OBJECT CASE IS THE NORMAL ONE, and missing it was a real bug: the Neo4j
  // connection installs a read transformer, so a stored rich-text string arrives
  // here as a RichTextDocument *object*. The first version only handled strings
  // and fell through to `String(original)` — which, because the class sets a
  // toStringTag, yields the constant '[object RichText]' for every row. Every
  // body in the graph collapsed to the same generated text and lost its
  // structure, and the ETL then dropped 30 of 32 comments because it could no
  // longer parse them. Exactly the mistake the project extractor's notes field
  // had, made again one layer down.
  let raw: { blocks?: unknown[] } | undefined;
  if (original !== null && typeof original === 'object') {
    raw = original as { blocks?: unknown[] };
  } else if (RichTextDocument.isSerialized(original)) {
    try {
      raw = RichTextDocument.fromSerialized(original) as unknown as {
        blocks?: unknown[];
      };
    } catch {
      raw = undefined;
    }
  }

  // Anything with no usable document — a plain string, or JSON we couldn't read —
  // becomes a VALID single-block document rather than bare text. A rich-text
  // column has to hold rich text: emitting a plain string is what made the value
  // unloadable in the first place. This also repairs a field previously mangled
  // by that bug, instead of leaving it permanently unparseable.
  if (!raw || !Array.isArray(raw.blocks)) {
    const text = typeof original === 'string' ? original : '';
    return RichTextDocument.serialize(
      RichTextDocument.fromText(proseLike(text || 'placeholder')),
    );
  }
  const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const scrubbedBlocks = blocks.map((block) => {
    if (block === null || typeof block !== 'object') return block;
    const data = (block as { data?: unknown }).data;
    if (data === null || typeof data !== 'object') return block;
    const text = (data as { text?: unknown }).text;
    if (typeof text !== 'string') return block;
    return {
      ...block,
      data: { ...data, text: proseLike(text) },
    };
  });
  return RichTextDocument.serialize(
    RichTextDocument.from({
      ...(raw as object),
      blocks: scrubbedBlocks,
    } as any),
  );
};

/**
 * Replacement for one value.
 *
 * `credential` returns null — emptied rather than faked. A plausible-looking
 * secret still reads as a secret and invites someone to try it. Passwords are the
 * exception and are handled by the caller, which writes one known development
 * hash so the copy can actually be logged into.
 */
export const fakeValue = (
  strategy: Strategy,
  original: unknown,
  /**
   * Id of the record the value hangs off, for the strategies in
   * {@link PER_RECORD_STRATEGIES}. Omit it and every strategy keys on the value
   * alone, which is the old behavior — so a caller that cannot cheaply learn the
   * owner still gets correct, deterministic output, just with the duplicate
   * names that come from value-only keying.
   */
  ownerId: string | null = null,
): string | null => {
  if (strategy === 'credential') return null;
  // richText BEFORE the string coercion below. It is the one strategy whose input
  // legitimately arrives as an object, and `String()`-ing that object is what
  // collapsed every document to one value and destroyed the structure.
  if (strategy === 'richText') {
    return original == null ? null : richTextLike(original);
  }
  // Also before the coercion, and for the same reason: this one's input may or
  // may not be an object, so it decides from the value in hand. The replacement
  // must keep the shape it replaces — a document written where a string was would
  // break every read of that field.
  if (strategy === 'proseOrRichText') {
    if (original == null) return null;
    return typeof original === 'object'
      ? richTextLike(original)
      : proseLike(String(original));
  }
  const value =
    typeof original === 'string' ? original : String(original ?? '');
  if (value === '') return value;
  // A non-string that survives to here would be silently stringified — which is
  // how the richText bug hid. Nothing else is expected to be an object, so say so
  // loudly rather than generating from '[object Object]'.
  if (typeof original === 'object') {
    throw new Error(
      `Strategy '${strategy}' received an object, not a string. Values arriving ` +
        `as objects need explicit handling (see richText) — generating from a ` +
        `stringified object silently collapses every row to one value.`,
    );
  }

  switch (strategy) {
    // ONE name per field, and that is the point. The single `personName`
    // strategy these two replace called `faker.person.fullName()` for all four
    // name links, so `realLastName` came back "Orlando Considine Jr." and
    // `realFirstName` came back "Sandy Ritchie" — honorifics and suffixes in
    // the wrong fields, and `initials` / `avatarLetters` derive from these.
    //
    // No uniqueness constraint on people's names, so no suffix — real name
    // collisions exist and should be allowed to exist here too. The pools are
    // small enough that collisions are frequent, which is closer to reality
    // than faker's near-unique output was.
    //
    // Both name pairs share a strategy on purpose: where a user's real and
    // display first names are the same string, their fakes match too, because
    // the replacement is a function of the value alone.
    case 'givenName':
      return pick('givenName', keyFor(strategy, value, ownerId), GIVEN_NAMES);

    case 'surname':
      return pick('surname', keyFor(strategy, value, ownerId), SURNAMES);

    case 'entityName':
      return `${seeded('entityName', value, () =>
        faker.company.name(),
      )} ${tagOf(value)}`;

    case 'languageName':
      // Deliberately not faker's language list: a real language name would be
      // indistinguishable from unscrubbed data, and someone WILL eventually ask
      // whether a copy was scrubbed. An invented word cannot be mistaken.
      return `${seeded('languageName', value, () =>
        faker.word.adjective(),
      )}-${tagOf(value).slice(0, 6)}`;

    case 'email':
      // `.invalid` is reserved by RFC 2606 and cannot resolve, so a stray dev
      // notification can never reach a real person.
      return `${seeded('email', value, () =>
        faker.internet
          .username()
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, ''),
      )}.${tagOf(value).slice(0, 8)}@example.invalid`;

    case 'phone':
      // 555-01xx is the reserved fictional block — not dialable.
      return `+1 555 01${(seedOf('phone', value) % 100)
        .toString()
        .padStart(2, '0')}`;

    case 'address':
      return seeded(
        'address',
        value,
        () => `${faker.location.streetAddress()}, ${faker.location.city()}`,
      );

    case 'prose':
      return proseLike(value);
  }
  // No `richText` case: it returns above, before the string coercion, because its
  // input is legitimately an object. TypeScript enforces that this switch is
  // exhaustive over what remains.
};

/**
 * `sortValue` on a field record is derived from its value, so it has to be
 * regenerated alongside — otherwise the original leaks through the sort key,
 * which is the kind of thing a field-by-field review misses.
 */
export const sortValueFor = (scrubbed: string | null): string | null =>
  scrubbed === null ? null : scrubbed;
