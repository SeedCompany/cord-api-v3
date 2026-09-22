# Partner Quarterly Reporting — Epics, Stories & Effort Estimate

Work breakdown and high-level effort estimate for the requirements in
[`partner-quarterly-reporting-prd.md`](./partner-quarterly-reporting-prd.md).
Each story references the PRD requirement(s) it satisfies (`REQ-##`) so
acceptance criteria don't have to be re-derived when the story is turned
into an issue.

Five epics, mapping roughly to milestones. Epics 1–4 are shipped —
included here for the estimate-vs-actual record and because the same
breakdown is the fastest way to onboard someone rebuilding this from
scratch. Epic 5 is planned and not started.

**Rebased onto `gtl-reports` (2026-09-22).** Epic 1 no longer exists as
separate work on this branch: GTL had independently absorbed the Post model
it introduced, so those commits were dropped as duplicates rather than
replayed. What remains on top of `gtl-reports` is Epics 2–4 plus the shared
tooling fix. Stories 1.1–1.5 are kept below as the record of what that
foundation cost to build, not as work still to do.

## Estimation basis

- Units are **engineer-days** for one mid/senior full-stack engineer
  already ramped on this codebase — not calendar days, and not a team
  velocity conversion.
- Ranges reflect genuine uncertainty, not padding. Take the low end for
  "everything goes as expected," the high end for "normal friction."
  Estimates for **Epic 5 are pre-spike** — nobody has built an extraction
  pipeline against this schema yet, so treat 5.1–5.2 as a time-boxed spike
  and revisit 5.3–5.5 once real results are in.
- Excludes code review turnaround, formal QA pass, staging/production
  rollout, and cross-team coordination — purely the engineering build
  time.
- Backend and frontend work are estimated together per story where a story
  spans both, since that's how the reference implementation was actually
  built and verified (live, end to end, per change) — split them at issue
  creation time if your team tracks backend/frontend as separate tickets.

## Rollup

| Epic | Status | Stories | Estimate |
|---|---|---|---|
| 1 — Post Curation & Moderation Foundations | Shipped | 5 | 6–9 days |
| 2 — Community Story Exclusivity | Shipped | 3 | 3–4 days |
| 3 — Media Investor Report Cap | Shipped | 2 | 1.5–2 days |
| 4 — Read-Only Report Detail Page | Shipped | 3 | 2.5–3 days |
| **Shipped subtotal** | | **13** | **13–18 days** |
| 5 — AI-Assisted Document Intake | Planned | 5 | 14–22 days |
| **Total** | | **18** | **27–40 days** |

As elapsed time for one engineer working alone: **roughly 5.5–8 weeks**
end to end. Epics 1–4 have little interdependency and can run in parallel
across two engineers (e.g. one on backend cap/policy logic, one on the
shared moderation UI); Epic 5's sub-stories parallelize less cleanly since
5.3 and 5.4 both depend on 5.2's output shape being settled first.

---

## Epic 1 — Post Curation & Moderation Foundations

**Status:** Shipped · **Estimate:** 6–9 days

Adds the two fields (`finalBody`, `featured`) and the moderation surface
that makes them usable, on the `Post` entity used for prayer content.

| Story | Description | Satisfies | Est. |
|---|---|---|---|
| 1.1 | Add `Post.finalBody`: schema migration, DTO field, edit policy (translator / PM / regional director / field ops director / marketing), audit history captures the original at creation. | REQ-01 | 2–3 days |
| 1.2 | Add `Post.featured` + edit policy (PM, marketing) + service-layer precondition checks (attached to a report, cleared to at least "Ask to Share Externally") + cap-of-3 enforcement + migration. | REQ-02 | 2 days |
| 1.3 | Consolidate clearance / final-wording / featured controls into one shared edit surface, reachable from the report's prayer step and from the engagement's prayer view. | REQ-05 | 2–3 days |
| 1.4 | Replace the clickable-status-chip pattern with an explicit toggle for the featured control. | REQ-05 | 0.5 day |
| 1.5 | Wire inline error rendering for every mutation on the shared surface (1.2's cap, 1.2's precondition checks, any future addition to this surface). | REQ-07 | 1 day |

---

## Epic 2 — Community Story Exclusivity

**Status:** Shipped · **Estimate:** 3–4 days

A report has exactly one featured community story; featuring a new one
must demote the old one everywhere that matters.

| Story | Description | Satisfies | Est. |
|---|---|---|---|
| 2.1 | Transaction-safe exclusive-feature logic: clear every other story sharing the report + prompt type, set the target, in one transaction. | REQ-03 | 1 day |
| 2.2 | Mutation returns every row whose `featured` value changed (not just the target), and the resolver/service types move from single-object to list to match. | REQ-03 | 1 day |
| 2.3 | Add live-query invalidation for every changed row on this (necessarily hand-rolled) write path; if porting the structural guard test, include it here. Budget for getting the *key* right, not just the call: it must name the GraphQL type the store indexes under, and a wrong key looks identical to a right one in logs and in the guard test. | REQ-03, platform constraint on hand-rolled writes | 1–2 days |

---

## Epic 3 — Media Investor Report Cap

**Status:** Shipped · **Estimate:** 1.5–2 days

| Story | Description | Satisfies | Est. |
|---|---|---|---|
| 3.1 | Per-report count query for media in the Investor Communications variant + cap-of-4 enforcement on the direct-upload path. | REQ-04 | 1 day |
| 3.2 | Same cap enforcement on the "reuse an earlier variant's file" path, sharing the check with 3.1 rather than re-implementing it. | REQ-04 | 0.5–1 day |

---

## Epic 4 — Read-Only Report Detail Page

**Status:** Shipped · **Estimate:** 2.5–3 days

| Story | Description | Satisfies | Est. |
|---|---|---|---|
| 4.1 | Media and prayer summary cards on the read-only report view (counts, Investor Report membership, per-item clearance status). | REQ-06 | 1–1.5 days |
| 4.2 | Other Activities and Next Quarter Plans cards on the read-only view. | REQ-06 | 1 day |
| 4.3 | Community story card distinguishes the currently-featured story from the others. | REQ-06 | 0.5 day |

---

## Epic 5 — AI-Assisted Document Intake

**Status:** Planned, not started · **Estimate:** 14–22 days (pre-spike)

Upload a Word document to a report and have it pre-fill the Field Partner
variant of each matching section, instead of the partner retyping
everything.

| Story | Description | Satisfies | Est. |
|---|---|---|---|
| 5.1 | Docx → text/markdown extraction utility, including pulling embedded images out separately. Pure format conversion, no model calls — testable against a handful of real sample documents on its own. | REQ-08 | 2–3 days |
| 5.2 | Segmentation & classification pipeline: chunk extracted text, classify each chunk against a given report's real, live prompt catalog, emit per-chunk confidence and an explicit "unmatched" outcome. The core, highest-risk piece of this epic. | REQ-09 | 5–8 days |
| 5.3 | Write-path wiring: route each confidently-classified chunk through the existing create/submit/upload calls a manual entry already uses; per-section partial success (one bad chunk doesn't block the rest). | REQ-10 | 2–3 days |
| 5.4 | Upload affordance on the report edit screen + the "extracted from a document" marker (resolve the open design question on exact treatment first). | REQ-08, REQ-11 | 2–3 days |
| 5.5 | Validation pass: run the pipeline against a representative sample of real, previously-submitted partner reports before wider rollout; tune 5.2 based on actual failure modes. Not pure engineering time — the highest-variance item in this plan. | — | 3–5+ days |

**Recommendation:** time-box 5.1 + 5.2 as a spike, run 5.5's validation
against that spike's output before committing engineering time to 5.3 and
5.4. If extraction quality against real documents doesn't clear a
reasonable bar, that's a cheaper place to find out than after the write
path and UI are built around it.

---

## Sequencing notes

Epics 1–4 (shipped) had almost no cross-dependency and were built and
verified independently, in this order:

1. Epic 1 first — later work assumes `finalBody`/`featured` and the shared
   moderation surface already exist.
2. Epics 2, 3 in either order, or in parallel across two engineers —
   neither depends on the other.
3. Epic 4 last, since it surfaces data from all three prior epics.

Epic 5 is a separate track that can start any time after Epic 1 exists
(it reuses Epic 1's `featured`/moderation model for prayer content), but
its own internal sequence is strict: 5.1 → 5.2 → 5.3/5.4 → 5.5.
