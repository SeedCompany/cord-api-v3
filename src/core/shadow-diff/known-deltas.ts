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
      'fixed (A1 triage 2026-08-27); the Postgres answer is the right one. ' +
      'Stakes verified 2026-08-27: cord-field never queries, displays, or ' +
      'mutates unavailabilities (grepped — zero operations, zero rendering), ' +
      'so the divergence has NO UI surface. That is a claim about cord-field ' +
      'only, not about all readers — the BI pipeline reads through the same ' +
      'GraphQL API and has not been checked.',
    op: /^user\.byId/,
    persona: /./,
    path: /(^|\.)unavailabilities(\.|$)/,
  },
  // U17 (anonymous user listed on Postgres) and U18 (primaryPartnership
  // hardcoded null) were removed 2026-08-28: their fixes merged to develop
  // (#3865, #3868) and arrived here with the catch-up rebase. Their deltas
  // must now show as MATCHES on the next capture — if either difference
  // reappears, it should be loud, not suppressed.
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
  // ---------------------------------------------------------------------
  // CR1-* — the four classes from the FIRST FULL CERTIFICATION RUN
  // (2026-08-28, cord_cutover_r5; ledger section of the same date).
  // Approved as a set by Rob 2026-08-28. Every count below was measured on
  // BOTH the r4-day2 and r5-certify captures with IDENTICAL per-op numbers —
  // two independent loads and two independent capture rounds — so each class
  // is deterministic engine behavior, not run-to-run churn.
  // ---------------------------------------------------------------------
  {
    ref: 'CR1-order',
    reason:
      'Array ordering under tied sort keys, suppressed globally (Rob, ' +
      '2026-08-28). Arrays are id-aligned (diff.ts 2026-08-27): every element ' +
      'is matched by identity and every field compared, so the single ' +
      '`«order»` entry per array records only the permutation of SHARED ids. ' +
      'Neither engine defines that permutation — legacy rows carry identical ' +
      'migration-era timestamps, and ties fall through to Neo4j internal ' +
      'order vs Postgres heap/collation order. Measured: 182 entries across ' +
      '15 list surfaces, per-op counts identical across two independent ' +
      'loads+captures. Value and membership differences are NOT covered — a ' +
      'reordering caused by a dropped sort key also displaces page ' +
      'membership, which stays loud on any op outside the CR1-membership ' +
      'scope. Subsumes the retired disabled candidates for name-sort ' +
      'collation and users.list fullName folding (see git history); the ' +
      'anonymous-user count signal those notes protected lives in totals ' +
      'and membership, which this rule does not touch.',
    op: /./,
    persona: /./,
    path: /\.«order»$/,
  },
  {
    ref: 'CR1-totals',
    reason:
      'List totals lower on Postgres by exactly the documented ETL drops ' +
      '(Rob, 2026-08-28). products.list: 82,198 → 80,320 (Δ1,878 == ' +
      'loss-manifest notHydrated.Product), Δ173 under the methodology ' +
      'filter; periodicReports.list: 218,228 → 211,217 (Δ7,011 == ' +
      'notHydrated.PeriodicReport), Δ6,721 for the Progress-type subset. ' +
      'The guard against these deltas silently growing is NOT this registry: ' +
      'compare-loss-manifest.ts fails the certify run on any drop growth ' +
      'against the committed baseline (loss-manifest.baseline.json), so a ' +
      'new or bigger drop goes red in the manifest phase before it could ' +
      'hide here. Scoped to exactly the measured ops; a total delta on any ' +
      'other op stays red.',
    op: /^(?:products\.list\.(?:default|filter-methodology|sort-createdAt-desc)|periodicReports\.list\.(?:default|filter-type-progress|sort-end-desc))$/,
    persona: /./,
    path: /(^|\.)total$/,
  },
  {
    ref: 'CR1-membership',
    reason:
      'Page-membership churn at the page-1-of-25 boundary under tied sort ' +
      'keys (Rob, 2026-08-28): whole rows present in the first page on one ' +
      'engine and «absent» on the other because ties are broken differently, ' +
      'while the underlying sets match (totals on these ops either agree or ' +
      'are the CR1-totals dropped-row deltas). Measured: 844 entries, per-op ' +
      'counts IDENTICAL across two independent loads+captures. Scoped to ' +
      'exactly the measured ops ON PURPOSE — membership churn on any op not ' +
      'listed here stays red, because this signal is how the dropped-sort-key ' +
      'bug on users/unavailability/education was caught (53488a43f). Only ' +
      'whole-item entries at `items[id=…]` are covered; a FIELD difference ' +
      'inside a matched item has a deeper path and stays red.',
    op: /^(?:engagements\.list\.(?:default|filter-type-language)|products\.list\.(?:default|filter-methodology)|organizations\.list\.sort-createdAt-asc|languages\.list\.sort-createdAt-asc|periodicReports\.list\.(?:default|filter-type-progress|sort-end-desc)|progressReports\.list\.(?:default|filter-status-notStarted)|users\.list\.(?:default|sort-displayLastName-desc))$/,
    persona: /./,
    path: /\.items\[id=[^\]]+\]$/,
  },
  {
    ref: 'CR1-membership',
    reason:
      'Same page-membership class as the list rule above, on the NESTED ' +
      'products page inside a single engagement document: these four legacy ' +
      'engagements carry more than one page of products, so the first-page ' +
      'read in the corpus hits the same tied-key boundary. Ids are pinned to ' +
      'the measured draws (the corpus/sampling draw is deterministic — ' +
      'identical across r4-day2 and r5-certify); a different engagement ' +
      'showing churn stays red.',
    op: /^engagement\.(?:byId|ceremonyBlank):(?:5c4279179503d5cd78e84b70|5c4279179503d5cd78e84b73|5c4279179503d5cd78e84c84|5c4279179503d5cd78e852a5)$/,
    persona: /./,
    path: /^data\.engagement\.products\.items\[id=[^\]]+\]$/,
  },
  {
    ref: 'CR1-partners-gic',
    reason:
      'partners.list.filter-globalInnovationsClient under the Marketing ' +
      'persona: Neo4j throws a masked "Failed" error (root cause on the ' +
      'Neo4j side unexplained — possibly the known Neo4j partner-list query ' +
      'blowup) while Postgres answers correctly with the 8 matching ' +
      'partners. Neo4j-only wrongness the port does not share; the class ' +
      'disappears at cutover when Neo4j is retired. Scoped to exactly this ' +
      'op + persona (3 entries: the null data document and the error pair); ' +
      'any other persona or filter failing stays red.',
    op: /^partners\.list\.filter-globalInnovationsClient$/,
    persona: /^Marketing$/,
    path: /^data$|^errors(?:\.length|\[\d+\])$/,
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
