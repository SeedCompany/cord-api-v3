# PRD — GTL Quarterly Reporting: Post-domain realignment

| | |
| --- | --- |
| **Sponsor** | Seth McKnight, Director of Technology |
| **Status** | Draft — for review alongside Quarterly Report Intake (Bryan Nelson / Abby Roberts) and the Prayer Requests plan of record |
| **Drafted** | 10 Sep 2026 |
| **Depends on** | [`ALIGNMENT.md`](./ALIGNMENT.md) — read that first; this PRD is the response to it |

## 1. Problem

GTL (Global Translation Leader) quarterly reporting shipped a working POC — goals, practicum,
community impact, prayer, media, workflow — verified end to end against local Postgres, 15 API
commits and 12 field commits on `gtl-reports`, not yet pushed. Independently, two other efforts
have been reshaping the exact domain GTL's Prayer and Media sections sit on: the Quarterly Report
Intake improvement (bringing Momentum field partners into Cord directly) and the Prayer Requests
plan of record (a portfolio-wide Post/Prayer redesign, three weeks newer than the Intake work and
already partially superseding it).

None of the three efforts is wrong in isolation. Each is a reasonable answer to the question it was
asked. The problem is that GTL's answer to "how does prayer attach to a report" disagrees with the
other two on the same table, the same interface, and — per the newest plan of record's own line-by-
line review of the `gtl-reports` worktree — GTL is the one that should move. Merging GTL as-is would
mean: a `PostFilters` field two branches both add differently, a `Postable` parent that flips a
second time in a follow-up PR, and prayer that still never reaches the channels the other two
efforts are actively fixing that exact gap for.

This PRD scopes the smallest change that gets GTL onto the converged model, without GTL building or
rebuilding any of the moderation/attribution machinery that belongs to (and is actively evolving
inside) the other two efforts.

## 2. Goals

1. GTL's prayer feature reads and writes through the same `Postable`/`PostFilters` surface every
   other Postable resource uses — no GTL-specific resolver, no GTL-specific filter field.
2. GTL's prayer requests survive the same report-churn (resync, soft-delete, sweep) that Momentum's
   already fixed for its own engagements, by construction, because they're on the same mechanism.
3. Zero duplicate schema. GTL does not add its own `approvedShareability`/`finalBody`-equivalent
   columns, its own report-attribution FK, or its own migration-numbering guess independent of the
   other in-flight branches.
4. When the shared moderation and DOMO-sync fixes land (owned elsewhere), GTL's prayer is covered by
   them automatically, not as a follow-up integration project.
5. The UI-level work GTL already did well — `fixedType`/`listField`/`readOnly` props, one section
   per post type instead of a dropdown — is preserved and reused, not thrown away with the resolver
   it was built against.

## 3. Non-goals

- **Rebuilding Quarterly Report Intake's or Prayer Requests' own scope.** This PRD does not
  re-plan Momentum's partner dashboard, reminders, document import, or the wider prayer
  distribution/investor-PWA work. Those have their own plans of record.
- **Moderation, translation, or curation for GTL prayer.** Out of scope until the shared mechanism
  (Finding 5) lands; GTL grants roles into it, GTL does not build it.
- **Investor-facing GTL media curation.** Consistent with the original GTL kickoff decision
  (investor-portal integration deferred); noted only so the eventual work reuses the existing
  `featured` pattern instead of a new one (Finding 7).
- **Fixing `language-domain-poc`'s competing prayer model.** Named in the alignment findings for
  sequencing awareness only; it is not this branch's code to change.

## 4. What ships

### 4.1 `Postable` moves to the engagement, declared once

`Engagement`'s own `IntersectTypes(...)` call gains `Postable`, so `LanguageEngagement`,
`InternshipEngagement`, and any future engagement subtype inherit it in one place. This is shared
plumbing — whichever of GTL, Quarterly Report Intake, or the Prayer Requests work lands it first,
the other two consume it rather than re-declaring it. See [`ALIGNMENT.md` §1–2](./ALIGNMENT.md).

### 4.2 `GTLReport` stops being `Postable`; prayer moves to the engagement

`GtlReportPrayerResolver` is deleted. `GTLReport` no longer implements `Postable`. GTL's report
detail page and edit wizard read prayer from `InternshipEngagement.posts(input: { filter: { types:
[Prayer] } })` instead of a report-scoped `prayerRequests` field — mechanically identical to how
Momentum's engagement-level Prayer tab already works.

### 4.3 GTL's internal `PostFilters.type` is deleted in favor of the shared `types`

One field, one meaning, one owner. GTL consumes `PostFilters.types` (plural, public) instead of
maintaining its own internal, singular variant. See [`ALIGNMENT.md` §3](./ALIGNMENT.md).

### 4.4 cord-field: re-point, don't rebuild

`PostForm`'s `fixedType`, `PostList`'s `fixedType`/`listField`/`readOnly`, and `CreatePost`'s
`listField` all stay as built. Only their `parent` prop changes — from the `GTLReport` id to the
`InternshipEngagement` id — and `listField` changes from the now-deleted `prayerRequests` to the
inherited `posts`.

### 4.5 No new moderation, attribution, or media schema in `gtl-reports`

GTL's `gtl_report_media` table is unchanged (Finding 7 — legitimate fork, no action). GTL adds no
`approvedShareability`/`finalBody`/`moderation_state` equivalent, and no report-attribution column
of its own. When the shared mechanism lands, GTL's own Supervisor/FPM-equivalent roles are granted
into it (a policy-only change, mirroring the existing `field-partner.policy.ts` `draft`-variant
grant shape) — no schema work inside this branch.

### 4.6 Migration renumbering, coordinated

`0039_add_gtl_reports.sql`, `0040_gtl_goals_tracking.sql`, and `0041_gtl_report_media.sql` are
renumbered once, after the cross-branch "genesis squash" (Finding 9) lands — not before, and not
piecemeal against a moving target.

## 5. What does not ship from this PRD

- Any change to `partner-quarterly-reporting`'s own moderation columns (that branch's problem to
  rework against the newer plan of record).
- The seed-api DOMO sync fix itself (F1) — GTL only requires that fix be written generically
  against `Postable`/`parent_type`, not hardcoded to `LanguageEngagement` (Finding 8). Verifying
  that is a story, not a rebuild.
- Dropping `language-domain-poc`'s `post_prayer_details` sidecar (not this branch's code).

## 6. Decisions

### Settled

- Prayer's `Postable` parent is the engagement, not the report — confirmed independently by two
  reviews (Quarterly Report Intake's own design doc, and the Prayer Requests plan of record's
  direct read of the `gtl-reports` worktree).
- `Postable` is declared once on the `Engagement` interface via `IntersectTypes`, never per-subtype
  `implements: [...]`.
- Report attribution is keyed on the report's period (engagement + type + start + end), not its row
  id, because report rows churn under resync.
- GTL builds no moderation mechanism of its own; it waits and grants roles.
- GTL's media table is a legitimate, deliberate fork from `progress_report_media` and is not
  touched by this reconciliation.

### Open

- **Sequencing dependency, not a design question:** which of the three efforts actually lands the
  `Postable`-on-`Engagement` change first. Whichever does, the others consume it — see
  [`BUILD_PLAN.md`](./BUILD_PLAN.md) §Sequencing.
- **Who owns the coordinated migration renumbering** (Finding 9) — it touches at least four
  branches outside GTL's own ownership (`partner-quarterly-reporting`, `growth-partners-project-type-poc`,
  `budget-line-items-poc`, `language-domain-poc`) and needs a single owner to sequence it, not four
  independent guesses.
- **Whether GTL's Supervisor/FPM sign-off roles map cleanly onto whatever role list the shared
  moderation policy ends up with** — can't be answered until that policy exists (Epic 2).

## 7. Risks

| Risk | Effect | Response |
| --- | --- | --- |
| GTL rebases onto `Postable`-on-`Engagement` before it actually lands upstream | GTL builds its own copy a second time, re-creating Finding 2's bug pattern | Sequence GTL's Epic 1 stories strictly after whichever branch lands the shared interface change (see Build Plan §Sequencing) |
| The DOMO sync fix (owned by Quarterly Report Intake) ships hardcoded to `LanguageEngagement` before this review reaches its owner | GTL prayer repeats the exact "silently invisible to DOMO" bug the fix was written to prevent | Epic 3, Story 3.1 — flag in that PR's review, not after merge |
| Migration renumbering (Finding 9) has no single owner and each branch renumbers independently | Four more hand-edited migration files disagreeing a second time | Epic 4 names an owner before any branch touches its migration numbers again |
| GTL's local commits are rebased/squashed before this reconciliation lands, losing the `fixedType`/`listField`/`readOnly` UI work | Re-derivation of validated UI-level design | Epic 1 explicitly preserves and re-points these props rather than deleting the components they live in |

## 8. Definition of done

GTL's `gtl-reports` branches contain no code that GTL alone owns duplicating the shared Post
domain: no bespoke `Postable` parent for prayer, no bespoke filter field, no bespoke moderation
column, no independent guess at a migration number. A prayer request created from the GTL wizard
is indistinguishable, at the API level, from one created from Momentum's engagement Prayer tab —
same parent, same filter, same (eventual) moderation gate — and the only thing that differs between
the two is which report, if any, a given post is attributed to.
