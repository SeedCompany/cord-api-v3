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
    path: /(^|\.)(total|hasMore)$|items\[\d+\]/,
    disabled: true,
  },
  {
    ref: 'collation — enable only after inspecting',
    reason:
      'ORDER-only differences on name sorts can stem from Neo4j vs Postgres ' +
      '(ICU/libc) collation rather than data. Disabled by default: inspect ' +
      'the ordering diffs first, then enable deliberately if confirmed.',
    op: /sort-(?:name|displayLastName)/,
    persona: /./,
    path: /^data\.[A-Za-z]+\.items\[\d+\]/,
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
