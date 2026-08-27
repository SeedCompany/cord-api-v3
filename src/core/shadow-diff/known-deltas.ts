/**
 * Known-deltas suppression registry.
 *
 * A rule matches a diff by (operation key, persona, JSON path). Matched diffs
 * are moved to the report's "suppressed" section — COUNTED and listed, never
 * silent — and do not fail the run. Every rule carries a mandatory `reason`
 * and `ref` (miss-ledger id) so each suppression is traceable.
 *
 * Add a rule only for a difference that has been investigated and accepted
 * (or ledgered for a later fix). Anything else should stay red in the report.
 */
export interface KnownDeltaRule {
  /** Ledger id (miss-ledger / finding reference). */
  readonly ref: string;
  readonly reason: string;
  /** Matches the operation key, e.g. `^project`. */
  readonly op: RegExp;
  /** Matches the persona role name. */
  readonly persona: RegExp;
  /** Matches the diff's JSON path, e.g. `(^|\.)photo(\.|$)`. */
  readonly path: RegExp;
  /** Disabled rules never match; they document a candidate suppression. */
  readonly disabled?: boolean;
}

const NON_ADMIN_PERSONAS =
  /^(?:ProjectManager|Consultant|Intern|FieldPartner|Marketing|StaffMember)$/;

export const knownDeltas: readonly KnownDeltaRule[] = [
  {
    ref: 'S1',
    reason:
      'Inactive-membership visibility: Neo4j read filters honor inactive ' +
      'project memberships while Postgres scopes to active ones, so project/' +
      'projectMember results under member personas can differ (~110 affected ' +
      'memberships in prod).',
    op: /^project/,
    persona: NON_ADMIN_PERSONAS,
    path: /./,
  },
  {
    ref: 'U14',
    reason:
      'user.photo null shape: Neo4j hydrates a truthy secured object with a ' +
      'null id where Postgres returns a null value.',
    op: /^user/,
    persona: /./,
    path: /(^|\.)photo(\.|$)/,
  },
  {
    ref: 'S6',
    reason:
      'ETL orDefault coalescing accepted as new truth (decided 2026-07-14): ' +
      'legacy partners missing the active / globalInnovationsClient ' +
      'properties load as false — the schema default the DTO contract ' +
      'always declared non-null.',
    op: /^partner/,
    persona: /./,
    path: /(^|\.)(active|globalInnovationsClient)(\.|$)/,
  },
  {
    ref: 'S6',
    reason:
      'ETL orDefault coalescing accepted as new truth (decided 2026-07-14): ' +
      'legacy users missing status / timezone properties load as Active / ' +
      'America/Chicago — the schema defaults the DTO contract always ' +
      'declared non-null.',
    op: /^user/,
    persona: /./,
    path: /(^|\.)(status|timezone)(\.|$)/,
  },
  {
    ref: 'S6',
    reason:
      'ETL orDefault coalescing accepted as new truth — same class as the ' +
      '2026-07-14 decision, extended to project.presetInventory 2026-08-25 ' +
      'after measuring the field. It marks a project as exposed to major ' +
      'investors to fund directly, and it has been retired in practice since ' +
      'early 2024: both Gel repositories hardcode false ("Not implemented ' +
      'going forward"), the last true was written 2024-03-28 and the last ' +
      'false 2024-01-31, while nulls are still being written today ' +
      '(2026-08-18). So the 2,185 null-or-absent projects are simply the ones ' +
      'created after the feature stopped being maintained — never decided ' +
      'false, never asked — and both answers mean "not in the preset ' +
      'inventory". The column is NOT NULL DEFAULT false by design ' +
      '(migration 0010) and the DTO declares a plain SecuredBoolean.',
    op: /^project/,
    persona: /./,
    path: /(^|\.)presetInventory(\.|$)/,
  },
  {
    // Deliberately NOT folded into the rule above. That one says "the property
    // was missing"; this project's was not — it has TWO simultaneously-active
    // presetInventory properties, true at 18:26:22.331 and false 357ms later,
    // which the Neo4j model does not allow for a single-valued field. Neo4j's
    // read returns the OLDER (true); the ETL took the newer (false), which is
    // what the last write actually said. Filing it under "coalescing" would
    // hide a source data-integrity bug behind an accepted decision.
    //
    // Measured 2026-08-25: exactly ONE project has duplicate active
    // presetInventory properties, so this is an anomaly and not a class. If a
    // later snapshot makes it more than one, this rule stops matching by id
    // and the run goes red — which is the intent.
    ref: 'S6-dup — a source anomaly, not a coalescing decision',
    reason:
      'project ZBTs8pD2lPx holds two active presetInventory properties in ' +
      'Neo4j (true, then false 357ms later). Neo4j reads the older, the ETL ' +
      'carried the newer. The ETL value is the defensible one; the source row ' +
      'is what needs fixing.',
    op: /^project\.byId:ZBTs8pD2lPx/,
    persona: /./,
    path: /(^|\.)presetInventory(\.|$)/,
  },
  {
    ref: 'U16',
    reason:
      'user.unavailabilities: the Neo4j repository lists ALL Unavailability ' +
      'nodes — unavailability.repository.ts:84 has no user filter — so every ' +
      'profile shows the entire table (3 rows in prod), while Postgres ' +
      'correctly scopes the list to the user. Neo4j-only wrongness the port ' +
      'fixed (A1 triage 2026-08-27); the Postgres answer is the right one.',
    op: /^user\.byId/,
    persona: /./,
    path: /(^|\.)unavailabilities(\.|$)/,
  },
  {
    ref: 'U17',
    reason:
      'The anonymous user (id `anonuserid`) is labelled AnonUser in Neo4j ' +
      'and dropped from user lists there, while Postgres has no marker ' +
      'column to read and lists it — totals run higher by exactly 1 and the ' +
      'row appears only on the Postgres side. The fix (exclude ' +
      'config.anonUser.id) is written on branch `pg-exclude-anon-user` ' +
      'targeting develop and is NOT on this lineage yet; remove this rule ' +
      'after the next catch-up merge and confirm the totals match on a ' +
      'fresh capture. Scoped away from the filter-status op on purpose — ' +
      'its totals stay red under the S6-cardinality decision below. ' +
      '`«order»` is deliberately NOT suppressed: dropping an unshared id ' +
      'cannot reorder the shared ones, so any order entry here is collation ' +
      'signal, not this delta.',
    op: /^users\.list\.(?:default|sort-)/,
    persona: /./,
    path: /\[id=anonuserid\]|(^|\.)(total|hasMore)$/,
  },
  {
    ref: 'U18',
    reason:
      'project.primaryPartnership: the Postgres repository still hardcodes ' +
      'the hydrated value to null (project.drizzle.repository.ts) while ' +
      'Neo4j resolves the primary partnership, so Neo4j returns an id where ' +
      'Postgres returns null. The fix is written on branch ' +
      '`pg-project-primary-partnership` targeting develop (PR draft ' +
      '`pr-primary-partnership.md`) and is NOT on this lineage yet; remove ' +
      'this rule after the next catch-up merge and confirm on a fresh ' +
      'capture that the values match.',
    op: /^project\.byId/,
    persona: /./,
    path: /(^|\.)primaryPartnership(\.|$)/,
  },
  {
    ref: 'S6-progressTarget',
    reason:
      'ETL fill accepted as new truth (Rob, 2026-08-26): products with no ' +
      'progressTarget property in Neo4j (12,081 rows) load with a filled ' +
      'value instead of null. Same coalescing class as the other S6 rules; ' +
      'also registered in the column profiler ' +
      '(column-profile.run.ts, products.progress_target).',
    op: /^product\.byId/,
    persona: /./,
    path: /(^|\.)progressTarget(\.|$)/,
  },
  {
    ref: 'B1-records-order',
    reason:
      'Budget.records is a plain array with no defined order on EITHER ' +
      'engine — Neo4j returns Cypher collect() order and Postgres heap ' +
      'order (readManyByBudget has no ORDER BY). Records are id-aligned and ' +
      'every field compared, so only the `«order»` entry is suppressed. ' +
      'Post-cutover nicety: give the Postgres read a deterministic ORDER BY.',
    op: /^project\.budget/,
    persona: /./,
    path: /records\.«order»$/,
  },
  {
    ref: 'S8',
    reason:
      'Orphaned-partnership phantom counts (decided 2026-07-14, drop-and-log): ' +
      'partnerships whose Partner was soft-deleted are unreadable under Neo4j ' +
      '(counted in list total, absent from items) and are dropped by the ETL, ' +
      'so Postgres totals run lower by exactly the orphan count — and are the ' +
      'consistent ones.',
    op: /^partnerships\.list/,
    persona: /./,
    path: /(^|\.)(total|hasMore)$/,
  },
  {
    ref: 'S6-cardinality — NOT a suppression, a decision to re-open',
    reason:
      'The S6 rule above suppresses the orDefault status VALUE, but not its ' +
      'consequence on a FILTERED LIST TOTAL, and the two are different sizes of ' +
      'decision. Measured 2026-07-30: users.list.filter-status-active returns ' +
      'total 32 under Neo4j and 48 under Postgres, because 16 of 49 users carry ' +
      'no status Property at all and the ETL coalesces them to Active. So ' +
      '"Active users" becomes a 50% larger set — which is product meaning ' +
      '(who appears in pickers, assignment lists, reports), not a null-shape ' +
      'nicety. The 2026-07-14 decision was taken when the visible effect was a ' +
      'field reading Active instead of null; nobody had measured the list ' +
      'effect. Deliberately DISABLED so the diff stays red: it needs a call on ' +
      'whether statusless legacy users should be Active, or a distinct value / ' +
      'nullable column. Enable only after that call.',
    op: /^users\.list\.filter-status/,
    persona: /./,
    // `items\[[^\]]+\]` matches both index-wise ([3]) and id-aligned
    // ([id=xyz]) item paths (diff.ts aligns keyable arrays by id).
    path: /(^|\.)(total|hasMore)$|items\[[^\]]+\]|items\.«order»/,
    disabled: true,
  },
  {
    ref: 'collation — enable only after inspecting',
    reason:
      'ORDER-only differences on name sorts can stem from Neo4j vs Postgres ' +
      '(ICU/libc) collation rather than data. Disabled by default: inspect ' +
      'the ordering diffs first, then enable deliberately if confirmed. ' +
      'With id-aligned arrays (diff.ts, 2026-08-27) ordering drift surfaces ' +
      'as a single `items.«order»` entry per list rather than per-item ' +
      'shifts, so that is the path this rule would suppress.',
    op: /sort-(?:name|displayLastName)/,
    persona: /./,
    path: /^data\.[A-Za-z]+\.items\.«order»$/,
    disabled: true,
  },
  {
    ref: 'U-fullName-fold',
    reason:
      'user list fullName ordering: both engines now compare the SAME string ' +
      '(first and last concatenated — the two-column form was fixed 2026-08-19), ' +
      'but they fold it differently and that part is deliberate. `fullName` is a ' +
      'resolver field, not a @NameField, so DbSort finds no transformer and Neo4j ' +
      'orders it by raw code points — capitals before lower case, accented ' +
      'initials after `z`. Postgres keeps the display_order collation instead ' +
      '(Rob, 2026-08-19) so the list reads the way people expect and agrees with ' +
      'every other name sort in the app. Exact parity would mean `collate "C"`. ' +
      '⚠ STILL DISABLED, and not because the delta is unconfirmed: the same ' +
      'path also carries the anonymous-user difference (Postgres returns 2376 ' +
      'users to Neo4j`s 2375 — `anonuserid` is labelled AnonUser and Neo4j drops ' +
      'it, Postgres lists it). Enabling this now would hide that. ' +
      'UPDATE 2026-08-25: the user-list fix is written and lands on develop via ' +
      'branch `pg-exclude-anon-user` (the list now excludes config.anonUser.id, ' +
      'since there is no AnonUser marker column to read — see the manifest ' +
      'entry). It is NOT on this lineage yet; it arrives with the next catch-up ' +
      'merge. Enable this rule then, and confirm on a fresh capture that the ' +
      'users list totals match before trusting it — enabling it early would ' +
      'restore exactly the masking this note exists to prevent.',
    op: /^users\.list\.default$/,
    persona: /./,
    // The fold difference is order-only, so with id-aligned arrays it is one
    // `items.«order»` entry; the anonuserid row itself is the U17 rule above.
    path: /^data\.users\.items\.«order»$/,
    disabled: true,
  },
];

export const matchKnownDelta = (
  op: string,
  persona: string,
  path: string,
): KnownDeltaRule | undefined =>
  knownDeltas.find(
    (rule) =>
      !rule.disabled &&
      rule.op.test(op) &&
      rule.persona.test(persona) &&
      rule.path.test(path),
  );
