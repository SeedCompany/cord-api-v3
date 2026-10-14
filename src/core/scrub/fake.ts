import { faker } from '@faker-js/faker';
import type { JsonObject } from 'type-fest';
import { RichTextDocument } from '~/common';
import { type PlainStrategy } from './classification';
import { seedFor, tagOf } from './hash';
import { GIVEN_NAMES, LANGUAGE_NAMES, SURNAMES } from './theme';

/**
 * Deterministic replacement values.
 *
 * Every generator is a pure function of its inputs — (strategy, value), plus the
 * owning row's id for the per-record strategies. Two consequences, both
 * load-bearing:
 *
 *  - **Refreshes are stable.** The same person keeps the same fake name across
 *    monthly rebuilds, so a bookmark, screenshot or ticket from last month still
 *    points at something recognizable.
 *  - **Duplicates survive WHERE THEY MATTER.** Production contains projects
 *    sharing a name; identical inputs produce identical outputs, so the
 *    duplicate is preserved rather than accidentally resolved by the scrub.
 *    ⚠ Person names are the deliberate exception — they key on the row too,
 *    so two people who share a real name get different fakes. See
 *    {@link PER_RECORD_STRATEGIES} for the decision and what it trades away.
 *
 * The mirror of that: **distinct inputs produce distinct outputs**, guaranteed by
 * appending a hash suffix wherever the real value carried a uniqueness
 * constraint. A collision there would abort the scrub's own UPDATE, so it is
 * built in rather than left to luck — 40 bits over a few thousand values is a
 * ~1-in-100,000 risk, against a birthday collision on plain generated names
 * being near-certain.
 */

const seeded = <T>(strategy: string, value: string, make: () => T): T => {
  faker.seed(seedFor(strategy, value));
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
): string => pool[seedFor(strategy, value) % pool.length]!;

/**
 * Strategies keyed on the ROW (id + value) rather than the value alone.
 *
 * DECIDED (Rob, 2026-09-01): a person's full name should be unique across the
 * dataset. That cannot come from a bigger pool, because keying on the value
 * alone means everyone who shares a real first name necessarily lands on the
 * same fake one.
 *
 * Mixing the row's id into the seed fixes both halves of that at once:
 *  - **Duplicate full names go away.** Two different people with the same real
 *    name now get different fakes.
 *  - **The mixture improves.** Users are spread across the pool independently
 *    instead of clumping wherever a common real name happened to hash.
 *
 * What it deliberately gives up: the copy no longer shows that production has
 * people sharing a full name. Nothing measures duplicate PEOPLE, so the cost is
 * low; entity names, where a unique index makes collisions matter, are NOT in
 * this set and keep colliding exactly where production's do.
 *
 * ⚠ Not a uniqueness GUARANTEE. Hashing a few thousand rows into
 * given × surname combinations still collides about once by chance.
 */
const PER_RECORD_STRATEGIES: ReadonlySet<PlainStrategy> = new Set([
  'givenName',
  'surname',
]);

/**
 * Seed input for one value: the row's own key where the strategy is
 * per-record, the bare value otherwise.
 */
const keyFor = (
  strategy: PlainStrategy,
  value: string,
  rowKey: string | null,
) =>
  PER_RECORD_STRATEGIES.has(strategy) && rowKey ? `${rowKey}\0${value}` : value;

/**
 * Prose of comparable length — length matters because it drives rich-text
 * structure and column sizing. Trimmed at a word boundary so the result reads
 * as text.
 *
 * The output alphabet is letters, spaces and periods only, and `verify.ts`
 * relies on that: anything with a digit, a comma or a non-ASCII character in a
 * prose column is counted as a survivor.
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

/** A fixed `time` so a fallback document is the same on every refresh. */
const FALLBACK_DOCUMENT_TIME = 1_700_000_000_000;

interface BlockLike {
  readonly data?: { readonly text?: unknown } & Record<string, unknown>;
}

/**
 * Rich text keeps its document shape — same block count, same block types, same
 * ids — and only the words inside change. A reader of the copy sees a document
 * that behaves like the original; nothing of what was written survives.
 *
 * Postgres stores these as jsonb, so the value arrives as an OBJECT and goes
 * back as one. (The Neo4j-era scrubber once stringified that object to the
 * constant '[object RichText]' and collapsed every document in the graph to one
 * value — the object case is the normal one, and it is handled first.) The
 * serialized string form is still accepted, for a dump that predates the
 * jsonb column, and anything unparseable becomes a VALID single-block
 * document rather than bare text: a rich-text column has to hold rich text.
 */
const richTextLike = (original: unknown): JsonObject => {
  let raw: JsonObject | undefined;
  if (original !== null && typeof original === 'object') {
    raw = original as JsonObject;
  } else if (RichTextDocument.isSerialized(original)) {
    try {
      raw = RichTextDocument.fromSerialized(original) as unknown as JsonObject;
    } catch {
      raw = undefined;
    }
  }

  if (!raw || !Array.isArray(raw.blocks)) {
    const text = typeof original === 'string' ? original : '';
    return {
      ...RichTextDocument.fromText(proseLike(text || 'placeholder')),
      time: FALLBACK_DOCUMENT_TIME,
    } as unknown as JsonObject;
  }
  const blocks = raw.blocks.map((block) => {
    if (block === null || typeof block !== 'object') return block;
    const data = (block as BlockLike).data;
    if (data === null || typeof data !== 'object') return block;
    const text = data.text;
    if (typeof text !== 'string') return block;
    return { ...block, data: { ...data, text: proseLike(text) } };
  });
  return { ...raw, blocks };
};

export type Fake = string | JsonObject | null;

/**
 * Replacement for one value.
 *
 * `credential` returns null here; the scrub writes the development password
 * hash itself, because computing that hash needs the app's argon2 settings and
 * the caller has them.
 */
export const fakeValue = (
  strategy: PlainStrategy,
  original: unknown,
  /**
   * The row's id, for the strategies in {@link PER_RECORD_STRATEGIES}. Omit it
   * and every strategy keys on the value alone, which is correct and
   * deterministic, just with the duplicate names that come from value-only
   * keying.
   */
  rowKey: string | null = null,
): Fake => {
  if (strategy === 'credential') return null;
  // richText BEFORE the string coercion below. It is the one strategy whose
  // input legitimately arrives as an object.
  if (strategy === 'richText') {
    return original == null ? null : richTextLike(original);
  }
  const value =
    typeof original === 'string' ? original : String(original ?? '');
  if (value === '') return value;
  // A non-string that survives to here would be silently stringified — which is
  // how the richText bug hid. Nothing else is expected to be an object, so say
  // so loudly rather than generating from '[object Object]'.
  if (typeof original === 'object') {
    throw new Error(
      `Strategy '${strategy}' received an object, not a string. Values arriving ` +
        `as objects need explicit handling (see richText) — generating from a ` +
        `stringified object silently collapses every row to one value.`,
    );
  }

  switch (strategy) {
    // ONE name per field. No uniqueness constraint on people's names, so no
    // suffix; both name pairs share a strategy on purpose, so where a user's
    // real and display first names are the same string, their fakes match too.
    case 'givenName':
      return pick('givenName', keyFor(strategy, value, rowKey), GIVEN_NAMES);

    case 'surname':
      return pick('surname', keyFor(strategy, value, rowKey), SURNAMES);

    case 'entityName':
      return `${seeded('entityName', value, () =>
        faker.company.name(),
      )} ${tagOf(value)}`;

    case 'acronym':
      return seeded('acronym', value, () =>
        faker.string.alpha({ length: value.length, casing: 'upper' }),
      );

    case 'languageName':
      // DECIDED (Rob, 2026-09-03): themed like everything else. Keyed on the
      // value alone and drawing from the same pool `entity-name.ts` uses, which
      // is what preserves the real relationship: production usually stores the
      // SAME string in `name` and `display_name`, so both land on the same
      // fake instead of every language acquiring a distinct public alias.
      //
      // ⚠ The scrub marker is the ONLY thing that says a copy was scrubbed —
      // names no longer give it away.
      return pick('languageName', value, LANGUAGE_NAMES);

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
      return `+1 555 01${(seedFor('phone', value) % 100)
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

    case 'uniqueProse':
      return `${proseLike(value)} ${tagOf(value)}`;
  }
  // No `richText` or `credential` case: both return above. TypeScript enforces
  // that this switch is exhaustive over what remains.
};
