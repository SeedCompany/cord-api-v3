# Build plan — GTL Post-domain realignment

Work breakdown for [`PRD.md`](./PRD.md). Items are ID'd, dependency-ordered, and sized in rough
dev-days for one engineer, excluding review — for sequencing, not commitment. Unlike a normal build
plan, most of the critical path here is **coordination with two other in-flight efforts**, not new
code; say so plainly rather than padding estimates to look busier.

| | |
| --- | --- |
| **Total** | 5 workstreams, 15 work items, ~9 dev-days of GTL-side code + 3 coordination items with no fixed size |
| **Repos** | `cord-api-v3` (`gtl-reports`), `cord-field` (`gtl-reports`), `seed-api` (verification only) |
| **Drafted** | 10 Sep 2026 |

## Read this first

Three of five workstreams (2, 3, 4) are **blocked on work this branch doesn't own**. That's not a
scheduling inconvenience to route around — building GTL's own version of shared-Post moderation,
DOMO sync, or migration renumbering while waiting is exactly how GTL ended up needing this
reconciliation in the first place. Where a story says "wait," the estimate is the verification
work once the dependency lands, not a placeholder for building it anyway.

## Workstreams

### A — Postable realignment (GTL-owned, ~4.5 d)

The only workstream GTL fully controls end to end. Everything else waits on some part of the shared
`Postable`-on-`Engagement` change landing first (see Sequencing below) — these stories are the
GTL-side work *once that lands*, not before.

| ID | Repo | Work | Dep | Days |
| --- | --- | --- | --- | --- |
| A1 | api | Remove `Postable` from `GTLReport`; delete `GtlReportPrayerResolver` and its registration in `gtl-report.module.ts`.<br>**Done when:** `GTLReport` no longer resolves a `posts` or `prayerRequests` field; nothing in `gtl-report.dto.ts` references `Postable`. | shared `Postable`-on-`Engagement` change (external) | 0.5 |
| A2 | api | Delete GTL's internal `PostFilters.type` field (`list-posts.dto.ts`) and the corresponding `if (filter?.type)` branch in `post.drizzle.repository.ts`.<br>**Done when:** GTL's diff to `list-posts.dto.ts` and `post.drizzle.repository.ts` is a net removal; the shared `types` field is what remains. | shared `PostFilters.types` (external) | 0.5 |
| A3 | api | Grant `InternshipEngagement.posts` (filtered to Prayer) through the GTL policy the same shape `field-partner.policy.ts` already uses for `LanguageEngagement`.<br>**Done when:** a Supervisor/FPM-equivalent role can create/read a Prayer post on their internship engagement, and cannot on one they aren't a member of. | A1 | 1 |
| A4 | field | Re-point the GTL prayer card (`GtlPrayerCard.tsx`) at `InternshipEngagement.posts(input: { filter: { types: [Prayer] } })` instead of the deleted `GTLReport.prayerRequests`.<br>**Done when:** the card renders from the engagement, `fixedType`/`listField`/`readOnly` props are unchanged in shape, only their target parent/field changed. | A1, A3 | 1.5 |
| A5 | field | Update `CreatePost`'s `listField` default and the GTL report wizard's prayer step to write against the engagement's `posts` list rather than the deleted `prayerRequests`.<br>**Done when:** a prayer composed from inside a GTL report wizard appears both in the report's step and the engagement's own prayer surface, matching Momentum's "composed in the report, visible on the engagement either way" behavior. | A4 | 1 |

### B — Report attribution (shared, GTL waits then verifies, ~1 d)

| ID | Repo | Work | Dep | Days |
| --- | --- | --- | --- | --- |
| B1 | coord | Confirm the shared `report` attribution column (wherever it lands — Quarterly Report Intake or its Prayer-Requests successor) is keyed on report *period* (engagement + type + start + end), not row id, per [`ALIGNMENT.md` §6](./ALIGNMENT.md#6-report-attribution-should-be-keyed-on-the-reports-period-not-its-row-id). No GTL code — this is a review comment on someone else's PR. | — | — |
| B2 | api | Once B1's column exists, set it from GTL's report wizard when a prayer is composed as part of a quarterly report.<br>**Done when:** a GTL report's prayer step sets the attribution the same way Momentum's Prayer step does — compose-and-set on create, or attach-after via update. | B1, A5 | 1 |

### C — Moderation (shared, GTL grants only, size TBD after the shared work lands)

| ID | Repo | Work | Dep | Days |
| --- | --- | --- | --- | --- |
| C1 | coord | Track the shared `moderation_state`/`final_body` mechanism (Prayer Requests plan of record §Model) landing. No GTL code until it does — see [`PRD.md` §4.5](./PRD.md#45-no-new-moderation-attribution-or-media-schema-in-gtl-reports). | — | — |
| C2 | api | Grant GTL's Supervisor/FPM-equivalent roles into whatever policy exposes `final_body` editing, mirroring `field-partner.policy.ts`'s existing `draft`-variant grant shape.<br>**Done when:** a GTL Supervisor can clear a prayer request's reach the same way a Momentum moderator can, using the same mutation. | C1 | 0.5–1 (depends on the shape C1 lands with) |
| C3 | api | Verify (no new code expected) that `GtlReportCommunityImpact` inherits `PromptVariantResponse.featured` correctly once that column exists, since it's a plain shared-table column addition.<br>**Done when:** a GTL community-impact response can be marked `featured` through the existing generic mutation, with no GTL-specific code required. | migration `0040`-equivalent lands | 0.5 |

### D — DOMO sync verification (external fix, GTL verifies, ~1 d)

| ID | Repo | Work | Dep | Days |
| --- | --- | --- | --- | --- |
| D1 | coord | Review the seed-api posts-sync fix (Quarterly Report Intake's "F1") before it merges: confirm it branches on the `Postable` interface / `parent_type` generically, not on `LanguageEngagement` specifically. See [`ALIGNMENT.md` §8](./ALIGNMENT.md#8-the-domo-prayer-feed-regression-applies-to-gtl-too-and-needs-one-fix-not-two). No GTL code. | — | — |
| D2 | api/seed | Once F1 merges, verify a GTL-originated, engagement-parented prayer request reaches the DOMO dataset at approved reach only — the same acceptance test Momentum runs for its own prayer.<br>**Done when:** an `InternshipEngagement`-parented prayer with `Approved`/equivalent reach appears in the DOMO posts dataset with an `/engagements/:id` URL; one without approved reach does not appear at all. | A1–A3, D1, C1 | 1 |

### E — Migration coordination (blocking, no design work, size TBD)

| ID | Repo | Work | Dep | Days |
| --- | --- | --- | --- | --- |
| E1 | coord | Name a single owner for the cross-branch migration renumbering ("genesis squash", tracked as PR #3882 per the Prayer Requests plan of record). Confirms which of `partner-quarterly-reporting`, `gtl-reports`, `growth-partners-project-type-poc`, `budget-line-items-poc`, and `language-domain-poc` renumbers against which baseline, and in what order. | — | — |
| E2 | api | Renumber GTL's `0039_add_gtl_reports.sql`, `0040_gtl_goals_tracking.sql`, `0041_gtl_report_media.sql` once E1's sequencing is set — not before, and not incrementally against a moving target.<br>**Done when:** GTL's migrations apply cleanly on top of the reconciled `develop`, in the slots E1 assigns. | E1, all of workstream A | 1 |
| E3 | coord | Confirm `language-domain-poc`'s competing `post_prayer_details` sidecar is dropped in the same coordinated pass (not this branch's code to change, but blocks a clean rebase if left standing). See [`ALIGNMENT.md` §10](./ALIGNMENT.md#10-a-third-competing-prayer-implementation-exists-on-language-domain-poc--outside-gtls-control-but-it-will-hit-the-same-rebase). | — | — |

## Sequencing

```
E1 (name an owner) ──────────────────────────────────────────────────┐
                                                                       │
shared Postable-on-Engagement lands (external) ──► A1 ─┬─► A3 ─► A4 ─► A5 ─► B2
                                                        │
shared PostFilters.types lands (external) ─────────────┴─► A2

B1 (verify period-keyed attribution, external) ───────────────────────► B2

C1 (shared moderation lands, external) ──► C2
                                       └──► C3 (independent of C2)

D1 (review F1 for genericity, external) ──► D2 (needs A1–A3 too)

E1 ──► E2 (needs all of A done first, so the renumbered migrations reflect the final shape)
E1 ──► E3 (no GTL dependency, just sequencing awareness)
```

Notes on the order:

- **Nothing in workstream A starts before the shared `Postable`-on-`Engagement` change actually
  lands somewhere** — landing GTL's own copy first is exactly the mistake this whole reconciliation
  exists to undo. If GTL needs to move first for its own scheduling reasons, land it as the
  reference implementation the other two consume, explicitly, rather than in parallel silence.
- **B, C, and D are independent of each other** and can run in parallel once their respective
  external dependencies land — they share no code.
- **E1 is the actual critical path.** Nothing renumbers cleanly, and no branch's PR is mergeable,
  until an owner is named and a sequence is agreed. This is a five-minute conversation blocking
  weeks of otherwise-ready work across four branches.
- **E2 waits until all of A is done**, so GTL renumbers once, against its final shape, rather than
  twice.

## Risks

| Risk | Effect | Response |
| --- | --- | --- |
| No one is named to own E1 | All five branches keep guessing migration numbers independently; the collision gets worse, not better, with time | Raise E1 as a standalone, five-minute decision — don't bundle it with the rest of this plan's approval |
| GTL's Epic 1 work starts before the shared `Postable` change lands, "to not block on someone else" | Recreates Finding 2's exact bug (per-subtype `implements` instead of interface-level `IntersectTypes`) a second time, on a third branch | Treat "shared change hasn't landed" as a hard blocker on A1, not a soft one |
| The DOMO sync fix (F1, owned by Quarterly Report Intake) ships before D1's review happens | GTL prayer repeats the "invisible to DOMO" bug the whole fix exists to prevent, requiring a second seed-api PR later | Flag D1 in that PR's review directly, don't wait for this plan's own timeline |
| The shared moderation mechanism's role model doesn't map cleanly onto GTL's Supervisor/FPM distinction | C2 grows past its 0.5–1d estimate into real policy design | Size C2 for real once C1's shape is known; this plan deliberately leaves it a range rather than guessing |

## Definition of done

- `GTLReport` no longer implements `Postable`; `GtlReportPrayerResolver` is deleted.
- GTL's `PostFilters.type` is gone; the branch consumes the shared `types` field with no
  GTL-specific filter code remaining.
- A prayer request created from the GTL report wizard is engagement-parented, appears on the
  engagement's own prayer surface, and reaches DOMO at approved reach exactly as a Momentum-
  originated one does — verified, not assumed.
- GTL's migrations apply cleanly, in their final renumbered slots, on top of the reconciled
  `develop` — no more hand-guessed `0039`+.
- Zero moderation, attribution, or media schema exists in `gtl-reports` that duplicates what the
  other two efforts already built or are actively building.
