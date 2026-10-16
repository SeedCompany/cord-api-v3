# Epic 4 — Cross-branch migration renumbering coordination

> Formatted to match the `SeedCompany/initiatives` Epic issue template. Covers Build Plan
> workstream **E**. This is the actual critical path of the whole reconciliation — see
> [`../BUILD_PLAN.md`](../BUILD_PLAN.md) §Sequencing.

**Description**

At least five branches (`partner-quarterly-reporting`, `gtl-reports`, `growth-partners-project-type-poc`,
`budget-line-items-poc`, `language-domain-poc`) independently number new Drizzle migrations starting
around `0039` against a `develop` baseline that has since moved past `0042`, and — per the Prayer
Requests plan of record's own verification — local trunk among some of these branches is already at
`0051`+. This is pure sequencing debt, not a design disagreement, but it blocks every other epic in
this reconciliation from landing cleanly: none of these branches can be rebased onto a shared
migration history until someone owns the renumbering. A "genesis squash" is referenced as pending
(PR #3882) in the Prayer Requests plan of record; this epic is the coordination to make that actually
happen rather than five more independent guesses.

**Opportunity Assessment Document**: N/A. See [`../ALIGNMENT.md`](../ALIGNMENT.md) §9–10.

**Project Proposal Document**: [`../PRD.md`](../PRD.md)

**Type of Request**: Infrastructure

**T-Shirt Size**: XS (< 2 weeks, 1 person) — the coordination itself is small; it unblocks work far
larger than itself.

**Associated EOS Rock**: N/A

**Priority Level**: P0 (Critical Path / Must Ship This Quarter) — this is the one item in the whole
reconciliation with no workaround. Every other epic here, and in the other two efforts, waits on it.

**Implementation Repositories**: `cord-api-v3`

## Implementation Stories

### Coordination (no repo-specific ticket type fits; track as a chore in `initiatives`)

- [ ] E1 — Name a single owner for the cross-branch migration renumbering. Confirm which of
      `partner-quarterly-reporting`, `gtl-reports`, `growth-partners-project-type-poc`,
      `budget-line-items-poc`, and `language-domain-poc` renumbers against which baseline, and in
      what order, resolving PR #3882's genesis squash.
  - **Depends on:** —
  - **Done when:** a written sequence exists (even a short one) naming the order branches
    renumber in, and who does it.
  - **Size:** — (a decision, not a build item; should take a conversation, not a sprint)
- [ ] E3 — Confirm `language-domain-poc`'s competing `post_prayer_details` sidecar table is dropped
      as part of the same coordinated pass, per its own plan-of-record verdict.
  - **Depends on:** E1
  - **Done when:** the table and its enum are removed from `language-domain-poc`, or a written
    reason exists for keeping them.
  - **Size:** — (not this epic's code; a checklist item for whoever runs the coordinated pass)

### cord-api-v3

- [ ] E2 — Renumber GTL's `0039_add_gtl_reports.sql`, `0040_gtl_goals_tracking.sql`,
      `0041_gtl_report_media.sql` into the slots E1 assigns.
  - **Depends on:** E1, and all of Epic 1's stories (so GTL renumbers its final shape once, not
    twice)
  - **Done when:** GTL's migrations apply cleanly on top of the reconciled `develop`, and
    `_journal.json` reflects the agreed sequence.
  - **Size:** 1d

## Technical Approach Summary

No design work. This epic is scheduling and ownership — the technical fix (a coordinated rebase and
`_journal.json` rewrite per branch) is small once someone is accountable for the sequence; the
absence of that owner is the entire problem today.

## Systems & Platforms Impacted

- `cord-api-v3`: migration files and `_journal.json` on at least five branches, one of which
  (`gtl-reports`) this epic directly renumbers (E2); the other four are named for awareness, not
  as this epic's deliverables.

## Known Risks & Mitigation Strategies

- **Risk:** E1 doesn't get a named owner because it looks like "someone else's problem" from inside
  each individual branch. **Mitigation:** raise it as a standalone five-minute decision, separate
  from approving the rest of this reconciliation — it shouldn't wait on PRD/build-plan sign-off.
- **Risk:** GTL renumbers (E2) before all of Epic 1 lands, then has to renumber again. **Mitigation:**
  E2 explicitly depends on all of Epic 1's stories being done first.

## Success Metrics

- Metric: number of branches independently guessing a migration number in the `0039`+ range at any
  given time. Baseline: at least 5. Target: 0 — one owner, one sequence.

## Technical Definition of Done

- [ ] A named owner and a written sequence exist for the cross-branch renumbering.
- [ ] GTL's three migrations are renumbered into their assigned slots and apply cleanly.
- [ ] `language-domain-poc`'s competing prayer table is either dropped or explicitly kept for a
      written reason.

**Project Review Issue**: N/A — create when this epic completes.
