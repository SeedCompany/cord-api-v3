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
