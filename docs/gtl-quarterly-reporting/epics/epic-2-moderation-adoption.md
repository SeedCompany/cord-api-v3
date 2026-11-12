# Epic 2 — Adopt the shared moderation model (no GTL-specific build)

> Formatted to match the `SeedCompany/initiatives` Epic issue template. Covers Build Plan
> workstream **C**.

**Description**

GTL prayer has no moderation today — no review step, no distinction between requested and cleared
reach. `partner-quarterly-reporting` already built one (`approvedShareability` + `finalBody` +
`featured` across three migrations); the Prayer Requests plan of record, three weeks newer,
supersedes that shape entirely with a `moderation_state` enum and `final_body` approval columns,
and is explicit that `partner-quarterly-reporting`'s own moderation code needs reworking to match.
This epic is deliberately almost entirely a "wait" — GTL grants roles into whichever mechanism lands,
and builds nothing of its own in the meantime.

**Opportunity Assessment Document**: N/A. See [`../ALIGNMENT.md`](../ALIGNMENT.md) §5.

**Project Proposal Document**: [`../PRD.md`](../PRD.md)

**Type of Request**: Enhancement

**T-Shirt Size**: XS (< 2 weeks, 1 person) — of actual GTL-side engineering time; the calendar time
is however long the shared mechanism takes to land, which this epic does not control.

**Associated EOS Rock**: N/A

**Priority Level**: P2 (No Specific Timeline) — GTL prayer today is no less moderated than it was
before this reconciliation (i.e., not at all); this epic makes it no worse while avoiding building
a model that would need reworking twice.

**Implementation Repositories**: `cord-api-v3`

## Implementation Stories

### cord-api-v3

- [ ] C1 — Track the shared `moderation_state`/`final_body` mechanism landing. No code; a
      watch-item, not a ticket with a deliverable.
  - **Depends on:** —
  - **Done when:** the mechanism exists on `develop` (or the branch GTL is rebasing against).
  - **Size:** — (tracking only)
- [ ] C2 — Grant GTL's Supervisor/FPM-equivalent roles into whatever policy exposes `final_body`
      editing, mirroring `field-partner.policy.ts`'s existing `draft`-variant grant shape.
  - **Depends on:** C1
  - **Done when:** a GTL Supervisor can clear a prayer request's reach using the same mutation a
    Momentum moderator uses — no GTL-specific mutation.
  - **Size:** 0.5–1d (depends on the exact policy shape C1 lands with; do not fix an estimate
    before that shape is known).
- [ ] C3 — Verify `GtlReportCommunityImpact` correctly inherits `PromptVariantResponse.featured`
      once that column exists.
  - **Depends on:** the `prompt_variant_responses.featured` migration landing (shared table, no
    GTL-side schema change needed).
  - **Done when:** a GTL community-impact response can be marked `featured` through the existing
    generic mutation with zero GTL-specific code.
  - **Size:** 0.5d (verification only; expected to require no code changes)

## Technical Approach Summary

No schema changes in this repo. This epic is a policy-only follow-on, sized deliberately small and
left partly unsized because its actual scope depends entirely on a decision (the shared moderation
model's shape) that another team owns.

## Systems & Platforms Impacted

- `cord-api-v3`: one policy addition (C2), one verification pass (C3). No migrations.

## Known Risks & Mitigation Strategies

- **Risk:** Pressure to ship *some* moderation for GTL prayer before the shared mechanism lands,
  because GTL prayer is live and unmoderated in the meantime. **Mitigation:** GTL's prayer volume
  and audience are both small and internal today (no DOMO reach, no investor exposure — see
  [`../ALIGNMENT.md`](../ALIGNMENT.md) §8); the cost of waiting is low, and the cost of building a
  second bespoke model (after `partner-quarterly-reporting` already built and is now reworking one)
  is not.
- **Risk:** GTL's Supervisor/FPM role split doesn't map cleanly onto whatever role list the shared
  policy uses. **Mitigation:** C2 is explicitly unsized until C1's shape is known; escalate as a
  design question rather than forcing a fit.

## Success Metrics

- Metric: GTL-specific moderation schema or mutations. Baseline: 0 today. Target: 0 after this
  epic too — success here is adopting shared infrastructure, not building GTL's own.

## Technical Definition of Done

- [ ] GTL Supervisor/FPM-equivalent roles are granted into the shared moderation policy.
- [ ] `GtlReportCommunityImpact` responses can be featured through the existing generic mutation.
- [ ] No new migration exists in `gtl-reports` for moderation.

**Project Review Issue**: N/A — create when this epic completes.
