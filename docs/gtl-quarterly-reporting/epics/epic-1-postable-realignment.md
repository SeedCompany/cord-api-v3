# Epic 1 — Flip GTL prayer onto the shared Postable/Engagement model

> Formatted to match the `SeedCompany/initiatives` Epic issue template
> (`.github/ISSUE_TEMPLATE/epic.yml`) so it can be pasted directly into a new Epic issue there once
> this is reviewed. Covers Build Plan workstreams **A** (Postable realignment) and **B** (report
> attribution).

**Description**

`GTLReport` currently implements `Postable` directly, so a GTL prayer request is parented to one
specific quarter's report row and dies or detaches with it. Quarterly Report Intake's own design
work, and independently the Prayer Requests plan of record's direct review of this branch, both
reach the same conclusion: the parent should be `InternshipEngagement`, with the report as an
optional, period-keyed attribution rather than the parent itself. This epic makes that change,
deletes the now-unnecessary report-scoped resolver, and re-points the (otherwise correct)
`fixedType`/`listField`/`readOnly` UI work at the engagement.

**Opportunity Assessment Document**: N/A — this is a technical reconciliation between two in-flight
efforts, not a new opportunity. See [`../ALIGNMENT.md`](../ALIGNMENT.md) §1–4, §6.

**Project Proposal Document**: [`../PRD.md`](../PRD.md)

**Type of Request**: Replacement / Migration

**T-Shirt Size**: S (2–4 weeks, 1 person) — mostly blocked-and-waiting rather than continuously
worked; see the Build Plan's Sequencing section for why the calendar time exceeds the ~4.5 dev-days.

**Associated EOS Rock**: N/A

**Priority Level**: P1 (High Priority / This Quarter or Next) — blocks GTL's `gtl-reports` branch
from being mergeable without a guaranteed merge conflict on `PostFilters` and a second `Postable`
migration later.

**Implementation Repositories**: `cord-api-v3`, `cord-field`

## Implementation Stories

### cord-api-v3

- [ ] A1 — Remove `Postable` from `GTLReport`; delete `GtlReportPrayerResolver` and its
      registration in `gtl-report.module.ts`.
  - **Depends on:** the shared `Postable`-on-`Engagement` change landing (owned outside this repo —
    see Epic 4 / Build Plan Sequencing). Do not start before it lands.
  - **Done when:** `GTLReport` no longer resolves a `posts` or `prayerRequests` field; nothing in
    `gtl-report.dto.ts` references `Postable`.
  - **Size:** 0.5d
- [ ] A2 — Delete GTL's internal `PostFilters.type` field (`src/components/post/dto/list-posts.dto.ts`)
      and the corresponding `if (filter?.type)` branch in `post.drizzle.repository.ts`.
  - **Depends on:** the shared, public `PostFilters.types` field landing (owned by
    `partner-quarterly-reporting`).
  - **Done when:** GTL's diff to both files is a net removal.
  - **Size:** 0.5d
- [ ] A3 — Grant `InternshipEngagement.posts` (filtered to Prayer) to GTL's Supervisor/FPM-equivalent
      roles, mirroring `field-partner.policy.ts`'s existing `LanguageEngagement` grant shape.
  - **Depends on:** A1
  - **Done when:** a Supervisor/FPM-equivalent role can create/read a Prayer post on their
    internship engagement, and cannot on one they aren't a member of.
  - **Size:** 1d

### cord-field

- [ ] A4 — Re-point `GtlPrayerCard.tsx` at `InternshipEngagement.posts(input: { filter: { types:
      [Prayer] } })` instead of the deleted `GTLReport.prayerRequests`.
  - **Depends on:** A1, A3
  - **Done when:** the card renders from the engagement; `fixedType`/`listField`/`readOnly` props on
    `PostForm`/`PostList`/`CreatePost` are unchanged in shape — only their target parent/field
    changed.
  - **Size:** 1.5d
- [ ] A5 — Update `CreatePost`'s `listField` default and the GTL report wizard's prayer step to
      write against the engagement's `posts` list.
  - **Depends on:** A4
  - **Done when:** a prayer composed inside the GTL report wizard appears both in the report's step
    and on the engagement's own prayer surface — matching Momentum's "composed in the report,
    visible on the engagement either way" behavior.
  - **Size:** 1d
- [ ] B2 — Once the shared, period-keyed `report` attribution column exists (see Epic 4), set it
      from the GTL report wizard when a prayer is composed as part of a quarterly report.
  - **Depends on:** B1 (coordination-only, no ticket) confirming the column is period-keyed; A5
  - **Done when:** a GTL report's prayer step sets attribution the same way Momentum's Prayer step
    does — compose-and-set on create, or attach-after via update.
  - **Size:** 1d

## Technical Approach Summary

No new schema in this repo. `Postable` moves from being declared per-subtype
(`implements: [Engagement, Postable]`, which the Prayer Requests plan of record flags as invisible
to `getImplementations()`) to one line on `Engagement`'s existing `IntersectTypes(...)` call — owned
by whichever of the three converging efforts lands it first, consumed by the other two. GTL's own
work is entirely deletion (the report-scoped resolver, the internal filter field) and re-pointing
(the cord-field components that already have the right shape).

## Systems & Platforms Impacted

- `cord-api-v3`: delete `gtl-report-prayer.resolver.ts` and its module registration; delete the
  internal `PostFilters.type` addition; add a policy grant.
- `cord-field`: re-point `GtlPrayerCard.tsx`, the GTL wizard's prayer step, and `CreatePost`'s
  `listField` default.

## Known Risks & Mitigation Strategies

- **Risk:** A1 starts before the shared `Postable`-on-`Engagement` change actually lands, "to not
  block." **Mitigation:** treat that dependency as hard, not soft — starting early recreates the
  exact per-subtype `implements` bug pattern this epic exists to remove, on a third branch.
- **Risk:** The cord-field re-point (A4/A5) is done as a rewrite rather than a re-point, discarding
  the validated `fixedType`/`listField`/`readOnly` design. **Mitigation:** review against
  [`../ALIGNMENT.md`](../ALIGNMENT.md) §4, which is explicit that these props are correct and
  should survive unchanged in shape.

## Success Metrics

- Metric: GTL-specific lines of code duplicating shared Post-domain concerns (parent declaration,
  filter fields, resolvers). Baseline: ~150 lines across `gtl-report-prayer.resolver.ts`,
  `list-posts.dto.ts`'s `type` field, and `post.drizzle.repository.ts`'s corresponding branch.
  Target: 0.
- Metric: Whether a prayer request created via the GTL wizard is structurally identical, at the API
  level, to one created via Momentum's engagement Prayer tab. Target: yes, verified by a shared
  test/manual check, not by code review alone.

## Technical Definition of Done

- [ ] `GTLReport` no longer implements `Postable`.
- [ ] `GtlReportPrayerResolver` is deleted.
- [ ] GTL's `PostFilters.type` is gone; only the shared `types` field remains.
- [ ] A prayer request composed in the GTL wizard is engagement-parented and visible on the
      engagement's own prayer surface.
- [ ] `yarn type-check` and `yarn lint` pass on both `gtl-reports` branches with these changes
      applied.

**Project Review Issue**: N/A — create when this epic completes.
