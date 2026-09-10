# Alignment findings: GTL vs. Quarterly Report Intake vs. Prayer Requests

Ten concrete places where GTL's local work disagrees with, duplicates, or is already superseded by
the other two efforts touching the same domain. Ordered roughly by how much code moves.

## 1. Prayer's parent is on the wrong resource

GTL made `GTLReport` implement `Postable` (`gtl-report.dto.ts`), with a `prayerRequests` field that
narrows the inherited `posts` list to `type: Prayer`. A prayer request is therefore parented to one
specific quarter's report row: it is created against `report.id`, and it lives or dies with that row.

The Quarterly Report Intake branch made `LanguageEngagement` implement `Postable` instead
(`engagement.dto.ts`, commit `36bcfed24`), with `Post` gaining an *optional* `report` reference
(migration `0039_add_post_report_and_moderation.sql`). Its own migration comment explains why:

> Reports are not stable objects. `sync-progress-report-to-engagement.handler` creates and removes
> them as an engagement's date window moves, migration 0035 made that a soft delete precisely
> because a hard one was destroying media, and `drop-internship-progress-reports.migration.ts`
> exists because a whole class of them was created in error and had to be swept. A prayer request
> must survive all of that: losing the report should lose the *attribution*, never the prayer.

That reasoning applies to `InternshipEngagement`/`GTLReport` identically — GTL reports are synced
and dropped by the same kind of handler, and GTL's own code has a documented Sept-2024 example of a
whole class of internship reports being created in error and swept.

The Prayer Requests plan of record (dated 2026-09-10) reviewed both branches directly and reached
the same verdict in these exact words:

> **gtl-reports worktree**: built it correctly (`GTLReport` Postable via `IntersectTypes`,
> `prayerRequests` narrows inherited posts to type Prayer, ordinary `createPost`, policy grants
> through parent edge) but chose the REPORT as parent. **Flip to `InternshipEngagement`, demote
> `GTLReport` to `report_id`** — the resolver already filters by `parentId`.

**Action:** flip GTL's `Postable` parent from `GTLReport` to `InternshipEngagement`. See Epic 1.

## 2. `Postable` should be declared once, on the `Engagement` interface — not per subtype

GTL declared `Postable` via `implements: [...]` alongside `IPeriodicReport`/`Resource`/`Commentable`
on the `GTLReport` class itself (correct mechanically, since `IntersectTypes` was used there). The
Quarterly Report Intake branch declared it via `implements: [Engagement, Postable]` directly on
`LanguageEngagement` (not through `IntersectTypes`). The Prayer Requests plan of record flags that
specific pattern as a latent bug, independent of which parent wins:

> Engagement must get Postable via `Interfaces = IntersectTypes(...)`, NOT
> `implements: [Engagement, Postable]` — the latter is invisible to `getImplementations()` (walks
> the prototype chain) so interface-level policy grants silently skip `LanguageEngagement`.

Declaring it once on the shared `Engagement` interface, rather than on each concrete subtype, also
means `InternshipEngagement` inherits it for free the same way `LanguageEngagement` would — one
line instead of one per engagement type, and the one place future engagement types (Growth
Partners, Multiplication) pick it up automatically too.

**Action:** when GTL's `Postable` grant moves to `InternshipEngagement` (Finding 1), make it a
one-line addition to `Engagement`'s own `IntersectTypes(...)` call, not a per-subtype `implements`.
This is shared plumbing with whichever branch lands first — see Epic 4.

## 3. `PostFilters` has two incompatible, competing edits on the same file

GTL added an **internal-only, singular** field:

```ts
// src/components/post/dto/list-posts.dto.ts (gtl-reports)
/**
 * Internal, like `parentId`: set by a resolver that owns a single kind of
 * post — GTL's prayer section — never by a caller.
 */
readonly type?: PostType;
```

The Quarterly Report Intake branch added a **public, GraphQL-exposed, plural** field to the same
class, for the identical use case, already anticipating GTL by name in its own doc comment:

```ts
// src/components/post/dto/list-posts.dto.ts (partner-quarterly-reporting)
@OptionalField(() => [PostType], {
  description: `
    Only these kinds of post.

    Exists so a surface dedicated to one kind — an engagement's prayer feed,
    say — can page through just that kind. ...
  `,
})
readonly types?: readonly PostType[];
```

These are not just a merge conflict on the same lines — they're two different answers to the same
question (is this filter internal-only or a real client-facing input; singular or plural) on the
one class both branches need. GTL's version is also strictly worse for its own purpose: it can't be
set from cord-field at all without a second internal-only special case, whereas `types` is a normal
list-input field cord-field already knows how to pass.

**Action:** delete GTL's `type` field and `gtl-report.drizzle.repository.ts`'s corresponding
`if (filter?.type)` branch entirely; consume the already-built `types` field once it lands. See
Epic 1.

## 4. `GtlReportPrayerResolver` becomes dead code once Findings 1–3 land

`src/components/gtl-report/gtl-report-prayer.resolver.ts` exists only to project
`InternshipEngagement`'s (currently `GTLReport`'s) `posts` list, filtered to `Prayer`, onto a
report-scoped `prayerRequests` field. Once `InternshipEngagement` is `Postable` and `PostFilters`
has a real `types` filter, cord-field can call
`internshipEngagement.posts(input: { filter: { types: [Prayer] } })` directly — the same shape the
Quarterly Report Intake branch's engagement-level prayer tab already uses. The whole resolver file,
and the `GtlReportPrayerResolver` registration in `gtl-report.module.ts`, is deleted, not migrated.

**What survives, unchanged:** cord-field's `fixedType` / `listField` / `readOnly` additions to
`PostForm`, `PostList`, and `CreatePost` (added for GTL's report-scoped prayer card) are the correct
UI-level shape for "a surface dedicated to one kind of post, no dropdown" — the Prayer Requests plan
of record independently arrives at "the UI gives each type its own section, so nobody chooses from
a dropdown" as a first-class requirement. These props should be **kept and pointed at the
engagement**, not thrown away with the resolver. See Epic 1.

## 5. GTL has no moderation model — and should not build the one the other two branches built

Today, a GTL prayer post is subject to whatever the generic `Post` policy grants and nothing else:
no review step, no distinction between "requested" and "cleared" reach. That's a real gap the
moment GTL prayer becomes engagement-parented and visible in a shared feed (Finding 1) — but the
fix is not to copy what's already on `partner-quarterly-reporting`.

That branch built `Post.shareability` (existing) plus a nullable `Post.approvedShareability`,
`approvedBy`, `approvedAt` (migration `0039`), then `Post.finalBody` (migration `0041`) and
`Post.featured` (migration `0042`) — a real, working, three-migration moderation system.

The Prayer Requests plan of record (2026-09-10) — three weeks newer — removes `shareability`
entirely and replaces this whole shape with a `moderation_state` enum
(`Submitted · AIProposed · Approved · Narrowed · Rejected · NeedsClarification`) plus `final_body` /
`final_body_approved_by_id` / `final_body_approved_at`, and is explicit that dropping `shareability`
and routing both `Post` read paths through `applyReadFilter` **must land in the same commit**, or
every post becomes readable by every authenticated user for as long as the gap is open. In its own
words, on why presence-of-`final_body` alone (which is closer to what the `partner-quarterly-reporting`
branch built) isn't enough:

> Presence alone cannot distinguish "rejected", "awaiting clarification" and "nobody has looked
> yet" — the exact ambiguity [the AI moderation design] refuses to accept for the agent, so it must
> not be accepted for humans either.

So `partner-quarterly-reporting`'s own moderation columns are themselves scheduled to be reworked.
Building GTL's own third version of "approved reach" now would mean two rewrites for GTL instead of
zero.

**Action:** GTL does **not** build a bespoke moderation model. Prayer posts stay internally visible
(their status quo today) until the shared `moderation_state`/`final_body` mechanism lands, then GTL
grants its Supervisor/FPM-equivalent roles into whatever policy exposes `final_body` editing —
mechanically the same shape as `field-partner.policy.ts`'s existing `draft`-variant grants. No
schema work happens inside the `gtl-reports` branch itself. See Epic 2.

## 6. Report attribution should be keyed on the report's *period*, not its row id

Both the existing `partner-quarterly-reporting` migration (`posts.report_id` as a literal FK to
`periodic_reports.id`) and GTL's current design (prayer parented directly to the report row) share
an unstated assumption: that a report's row id is stable across a quarter's lifetime. It isn't.
`periodic-report.drizzle.repository.ts` (lines 164–189, per the newest plan's verification) shows
the same fiscal quarter's report can come back under a *new* row id after the sync/re-create
handlers run — exactly the churn `partner-quarterly-reporting`'s own migration comment cites as the
reason engagement (not report) must be the parent in the first place. A row-keyed `report_id`
silently detaches on that resync; a period-keyed reference (engagement + report type + start + end,
re-resolved to whichever row currently represents that period) does not.

**Action:** whichever branch lands the `report` attribution column first should key it on the
report's period, not its id. This is one fix, shared by both `partner-quarterly-reporting` and any
future GTL attribution work — GTL should not add its own row-keyed reference in the meantime. See
Epic 1 and Epic 4.

## 7. Media: divergence is legitimate, but the two branches will still collide

GTL built a new `gtl_report_media` table (migration `0041_gtl_report_media.sql`) rather than
extending `progress_report_media`, on the reasoning that GTL media is never re-cut per audience
variant the way a Momentum highlight is — there is no "Investor Communications" pass on a GTL
photo. That reasoning holds; this is not a design conflict to resolve.

It is, however, a **migration-numbering** conflict: `partner-quarterly-reporting` independently
claims migration slots `0039`–`0042` for its own, unrelated changes (post moderation,
`prompt_variant_responses.featured`, `posts.final_body`, `posts.featured`), and GTL's `0041_gtl_report_media.sql`
was written against a different, older base — both branches currently think they own "0041". This
has nothing to do with media specifically; it's the same problem as Finding 9, and is called out
here only because media is where GTL's own new migration collides most directly.

**Forward-looking note, not required now:** if GTL ever needs investor-facing curation of its
media (out of scope for the current POC per the original kickoff decisions), reuse the
`featured`/cap pattern already built for `ProgressReportMedia`
(`MAX_FEATURED_MEDIA_PER_REPORT`, `ReuseProgressReportMedia`) and for
`PromptVariantResponse.featured` (migration `0040`, `PromptVariantResponseFeaturedDrizzleRepository`)
rather than inventing a third version. GTL's own `GtlReportCommunityImpact` already extends
`PromptVariantResponse`, so it inherits the `featured` column for free the moment
`partner-quarterly-reporting` (or its Prayer-Requests-plan successor) merges — no GTL code needed to
get that. See Epic 5 (deferred).

## 8. The DOMO prayer-feed regression applies to GTL too, and needs one fix, not two

`partner-quarterly-reporting`'s design doc identified that the seed-api posts sync
(`cord-to-domo/posts/Posts.cord.graphql`) queries only `Project` and `Partner` parents. Moving
prayer's parent to `LanguageEngagement` makes it invisible to that sync — not truncated, absent,
with no error — which is why that branch scoped a fix (workstream **F1**) specifically for it.

GTL's prayer, currently parented on `GTLReport`, was **never** going to reach DOMO either, for the
same underlying reason, and no equivalent fix was scoped for GTL (consistent with the original
kickoff decision that investor-portal / broader distribution is out of scope for the POC). Once
Finding 1 lands and GTL prayer moves to `InternshipEngagement`, it becomes eligible for exactly the
same sync fix Momentum is already building — **provided that fix is written against "any Postable
engagement" and not hardcoded to `LanguageEngagement`**. Written the narrow way, it will need to be
redone a second time the moment GTL's parent flips.

**Action:** when reviewing or implementing F1 (seed-api posts sync engagement support), require it
to branch on the `Postable` interface / `parent_type` generically rather than naming
`LanguageEngagement` specifically. See Epic 3.

## 9. Migration-number collision spans at least four branches, GTL included

Both API worktrees currently number new migrations starting at `0039` against a `develop` baseline
that has since moved. As of this review:

| Branch | Claims migration(s) |
| --- | --- |
| `partner-quarterly-reporting` | `0039_add_post_report_and_moderation`, `0040_add_prompt_variant_response_featured`, `0041_add_post_final_body`, `0042_add_post_featured` |
| `gtl-reports` | `0039_add_gtl_reports`, `0040_gtl_goals_tracking`, `0041_gtl_report_media` |
| `growth-partners-project-type-poc` | reported locally at `0051`+ per the Prayer Requests plan of record's own verification |
| `budget-line-items-poc` | also claims `0039`+ |
| `language-domain-poc` | also touches this range, and separately ships a *third*, competing prayer model (Finding 10) |

This is pure sequencing debt, not a design disagreement, but it blocks every other finding above
from landing cleanly — none of these branches can be rebased onto a shared migration history until
the numbering is reconciled. The Prayer Requests plan of record already names the mechanism:

> Don't fix a migration number until PR #3882's genesis squash lands; growth-partners, gtl-reports
> and budget-line-items all claim 0039+.

**Action:** treat this as a blocking, coordination-only workstream, sequenced before any of Findings
1, 2, 6, or 7 actually land in a mergeable PR. See Epic 4.

## 10. A third, competing prayer implementation exists on `language-domain-poc` — outside GTL's control, but it will hit the same rebase

`language-domain-poc` ships its own `post_prayer_details` sidecar table (its own `PrayerStatus`
enum, a nullable urgency string, `expiresAt`) — a third model, disagreeing with both GTL's and
`partner-quarterly-reporting`'s. The Prayer Requests plan of record's verdict is to drop it
outright: status and expiry belong in a query's `WHERE` clause over the eventual shared model, not a
join added to every feed read. This isn't GTL's branch to fix, but it's named here because whoever
sequences Epic 4's coordinated rebase needs to land this cleanup in the same pass — reconciling GTL
and `partner-quarterly-reporting` while a third branch still disagrees just relocates the conflict.

**Action:** no GTL-side work. Flag for whoever owns Epic 4 sequencing that `language-domain-poc`'s
`post_prayer_details` table needs to be dropped as part of the same coordinated rebase, not
separately. See Epic 4.

---

## Summary table

| # | Finding | GTL today | Target | Epic |
| - | --- | --- | --- | --- |
| 1 | Prayer's `Postable` parent | `GTLReport` | `InternshipEngagement`, `report` as attribution | 1 |
| 2 | How `Postable` is declared | `implements: [...]` on the report class | One line on `Engagement`'s `IntersectTypes` | 1 |
| 3 | `PostFilters` filter shape | Internal, singular `type` | Shared, public, plural `types` | 1 |
| 4 | `GtlReportPrayerResolver` | Exists, report-scoped | Deleted; UI props (`fixedType`/`listField`/`readOnly`) kept, re-pointed | 1 |
| 5 | Moderation | None | Wait for shared `moderation_state`/`final_body`; grant roles only | 2 |
| 6 | Report attribution keying | Row id (via direct parenting) | Report period, re-resolved | 1, 4 |
| 7 | Media table | New `gtl_report_media` (legitimate fork) | Unchanged; adopt shared `featured` pattern later, not now | 5 (deferred) |
| 8 | DOMO sync reach | Never reaches DOMO | Same F1 fix as Momentum, written generically | 3 |
| 9 | Migration numbering | Claims `0039`–`0041`, collides with 3+ branches | Coordinated renumber after genesis squash | 4 |
| 10 | Third competing model (`language-domain-poc`) | N/A — not GTL's branch | Dropped in the same coordinated pass | 4 |
