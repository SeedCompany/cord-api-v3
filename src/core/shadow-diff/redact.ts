import { createHash } from 'node:crypto';

/**
 * Value redaction for capture files (added 2026-07-31).
 *
 * WHY THIS EXISTS. The corpus reads real records out of Neo4j, so a capture file
 * held person names, email addresses, phone numbers, user-authored comment and
 * post bodies, and language names — alongside 213 records marked
 * `sensitivity: High`. Under Seed Company's AI protocol, high-sensitivity project
 * data and linguistic data held in confidence are **Restricted**, and PII is at
 * least Confidential. Those files sat in plain text at the repo root.
 *
 * WHY HASHING RATHER THAN DROPPING THE FIELDS. Parity is the whole point of this
 * harness: if Neo4j answers "X" and Postgres answers "Y", the run must fail. Drop
 * the field and that check disappears with it. Hash it and the check survives
 * intact — the same input hashes to the same digest under both engines, so a
 * mismatch still diffs, while nothing readable is stored. Full fidelity, no
 * content.
 *
 * The cost is that a diff report shows `#a1b2c3…` instead of the value, so a
 * human has to look the record up locally by id. That is the correct trade: the
 * report says WHICH field of WHICH record disagrees, which is all triage needs.
 *
 * migration-todo: delete with the rest of this folder at cutover.
 */

/**
 * Field names whose values are — or may be — classified data.
 *
 * Deliberately over-broad. Over-redacting costs only readability (parity still
 * holds via the digest); under-redacting writes protected data to disk. So a
 * field goes in here whenever it *could* carry a name or free text on any type,
 * even if it is innocuous on most: `name` covers Tool and FieldZone as well as
 * Language, and hashing those is harmless.
 */
const SENSITIVE_FIELDS: ReadonlySet<string> = new Set([
  // person + contact
  'fullName',
  'firstName',
  'lastName',
  'realFirstName',
  'realLastName',
  'displayFirstName',
  'displayLastName',
  'avatarLetters',
  'email',
  'phone',
  'about',
  'title',
  'position',
  // entity names, incl. language + project names
  'name',
  'displayName',
  'displayNamePronunciation',
  'description',
  // free text authored by people
  'body',
  'caption',
  'altText',
  'historicGoal',
  'skippedReason',
  'response',
  // education / employment detail
  'degree',
  'major',
  'institution',
]);

/**
 * Keys that stay readable even inside a redacted subtree. Ids are opaque and are
 * what makes a finding actionable — without them the report names no record.
 */
const NEVER_REDACT: ReadonlySet<string> = new Set(['id', '__typename']);

const digest = (value: string): string =>
  '#' + createHash('sha256').update(value).digest('hex').slice(0, 12);

/**
 * Walk a captured GraphQL response and hash every string inside a sensitive
 * field. `inSensitive` propagates through the `Secured*` wrapper so
 * `name { value }` is caught as well as a bare `name`.
 */
const walk = (node: unknown, inSensitive: boolean): unknown => {
  if (typeof node === 'string') {
    return inSensitive ? digest(node) : node;
  }
  if (Array.isArray(node)) {
    return node.map((item) => walk(item, inSensitive));
  }
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([key, value]) => [
        key,
        walk(
          value,
          NEVER_REDACT.has(key)
            ? false
            : inSensitive || SENSITIVE_FIELDS.has(key),
        ),
      ]),
    );
  }
  // numbers / booleans / null — never identifying on their own.
  return node;
};

/** Redact a captured operation's `data` before it is written to disk. */
export const redactCaptured = (data: unknown): unknown => walk(data, false);

/**
 * GraphQL error messages can quote a value (`Could not find Language "X"`), so
 * they are redacted too — but only the interpolated segments, since the message
 * text itself is the signal a diff needs. Quoted runs and parenthesised ids are
 * the two shapes the codebase actually produces.
 */
export const redactMessage = (message: string): string =>
  message
    .replace(/"([^"]{3,})"/g, (_, inner: string) => `"${digest(inner)}"`)
    .replace(/'([^']{3,})'/g, (_, inner: string) => `'${digest(inner)}'`);
