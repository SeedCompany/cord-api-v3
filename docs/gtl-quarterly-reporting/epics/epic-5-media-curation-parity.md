# Epic 5 — Media curation parity (deferred)

> Formatted to match the `SeedCompany/initiatives` Epic issue template. Not scheduled — recorded so
> it isn't rediscovered as a surprise later, matching how `partner-quarterly-reporting`'s own build
> sheet records its deferred DOMO items (F2–F4).

**Description**

GTL's `gtl_report_media` table is a deliberate, reasoned fork from `progress_report_media` — GTL
media is never re-cut per audience variant, so the variant-group model doesn't fit. That's not a
conflict to resolve. But if GTL ever needs investor-facing curation of its media (explicitly out of
scope for the current POC), the pattern to reuse already exists: `ProgressReportMedia`'s
`featured`/`MAX_FEATURED_MEDIA_PER_REPORT` cap and `ReuseProgressReportMedia`, and separately
`PromptVariantResponse.featured` (which `GtlReportCommunityImpact` already inherits for free once
that migration lands — see Epic 2, story C3). This epic exists only to record that reuse decision
before it's needed, so nobody re-derives a third `featured` mechanism under deadline pressure.

**Opportunity Assessment Document**: N/A — forward-looking placeholder, not an approved scope. See
[`../ALIGNMENT.md`](../ALIGNMENT.md) §7.

**Project Proposal Document**: [`../PRD.md`](../PRD.md) §3 (Non-goals)

**Type of Request**: Enhancement

**T-Shirt Size**: Not sized — no scope exists yet; this is a design note, not a plan.

**Associated EOS Rock**: N/A

**Priority Level**: P2 (No Specific Timeline)

**Implementation Repositories**: `cord-api-v3` (future)

## Implementation Stories

None yet. This epic has no stories because it has no approved scope — GTL investor-facing media
curation is explicitly out of scope per the original GTL kickoff decisions and this PRD's
non-goals. When and if it is scoped, the story should be "extend `gtl_report_media` with a
`featured` column and cap, following the exact pattern already built for `ProgressReportMedia`" —
not a new mechanism.

## Technical Approach Summary

Reuse, when needed: `featured: boolean` + a per-report cap, enforced the same
clear-then-set-in-one-transaction way `ProgressReportMedia`'s cap and
`PromptVariantResponseFeaturedDrizzleRepository.feature()` both already do. No new pattern to invent.

## Systems & Platforms Impacted

None yet — no code changes are part of this epic.

## Known Risks & Mitigation Strategies

- **Risk:** if GTL investor-facing media curation becomes urgent later, whoever picks it up
  reinvents the `featured`/cap pattern from scratch under deadline pressure, producing a third
  version alongside `ProgressReportMedia`'s and `PromptVariantResponse`'s. **Mitigation:** this
  document. Point whoever scopes that work here first.

## Success Metrics

Not applicable — no active scope.

## Technical Definition of Done

Not applicable — no active scope. This epic closes by being superseded with a real, scoped epic if
and when GTL investor-facing media curation is approved.

**Project Review Issue**: N/A.
