# Epic 3 — DOMO sync generic-parent verification

> Formatted to match the `SeedCompany/initiatives` Epic issue template. Covers Build Plan
> workstream **D**. Primarily a review obligation on someone else's PR, plus one verification
> story once it merges.

**Description**

`partner-quarterly-reporting` discovered that moving prayer's parent to `LanguageEngagement` makes
it invisible to the seed-api DOMO posts sync (which queries only `Project`/`Partner` parents), and
scoped a fix for it ("F1"). GTL's prayer, once it moves to `InternshipEngagement` (Epic 1), has the
identical exposure. This epic ensures the one fix covers both engagement types instead of needing a
second, near-identical PR later.

**Opportunity Assessment Document**: N/A. See [`../ALIGNMENT.md`](../ALIGNMENT.md) §8.

**Project Proposal Document**: [`../PRD.md`](../PRD.md)

**Type of Request**: Enhancement

**T-Shirt Size**: XS (< 2 weeks, 1 person)

**Associated EOS Rock**: N/A

**Priority Level**: P1 (High Priority / This Quarter or Next) — cheap to get right now (a review
comment), expensive to fix later (a second seed-api PR after GTL prayer has already shipped
silently absent from DOMO).

**Implementation Repositories**: `seed-api`, `cord-api-v3`

## Implementation Stories

### seed-api

- [ ] D1 — Review the posts-sync fix (Quarterly Report Intake's "F1") before it merges: confirm the
      engagement-parent lookup is written against the `Postable` interface / `parent_type`
      generically, not against `LanguageEngagement` by name.
  - **Depends on:** —
  - **Done when:** the reviewed PR's engagement-lookup code has no `LanguageEngagement`-specific
    branch, or an explicit, reviewed reason why it needs one.
  - **Size:** — (review only, not a build item)

### cord-api-v3 / seed-api

- [ ] D2 — Once F1 merges, verify a GTL-originated, engagement-parented prayer request reaches the
      DOMO dataset at approved reach only.
  - **Depends on:** Epic 1 (A1–A3), D1, Epic 2 (C1, so "approved reach" has a real definition to
    test against)
  - **Done when:** an `InternshipEngagement`-parented prayer with approved reach appears in the DOMO
    posts dataset with an `/engagements/:id` URL; one without approved reach does not appear at
    all.
  - **Size:** 1d

## Technical Approach Summary

No new code owned by this epic beyond the verification story. The actual fix is
`partner-quarterly-reporting`'s F1; this epic's job is making sure that fix is generic enough to
cover GTL by construction rather than by a follow-up PR.

## Systems & Platforms Impacted

- `seed-api`: reviewed only (D1), verified only (D2) — no GTL-authored changes expected.

## Known Risks & Mitigation Strategies

- **Risk:** F1 merges before this review happens, written narrowly against `LanguageEngagement`.
  **Mitigation:** flag D1 directly on that PR as soon as it's opened, rather than waiting for this
  plan's own timeline — the fix is cheaper before merge than after.

## Success Metrics

- Metric: number of DOMO-sync PRs required to cover both `LanguageEngagement` and
  `InternshipEngagement` prayer. Target: 1, not 2.

## Technical Definition of Done

- [ ] F1's engagement lookup is confirmed generic (or is made so, if caught before merge).
- [ ] A GTL prayer request's DOMO reach is verified end to end, matching the Momentum acceptance
      test.

**Project Review Issue**: N/A — create when this epic completes.
