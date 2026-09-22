# Partner Quarterly Reporting — Investor Curation, Moderation & Document Intake

Product requirements for the Investor Report curation, moderation, and
AI-assisted document intake work on Cord's Partner Quarterly Reports.

This is not a spec for Partner Quarterly Reporting as a whole. Reports,
prompts, media upload, and the base moderation/shareability model already
exist; this document covers what was added on top of that foundation, and
assumes an implementation integrates with — not replaces — it.

See [`partner-quarterly-reporting-plan.md`](./partner-quarterly-reporting-plan.md)
for how this breaks into epics, stories, and an effort estimate.

**Shared ground with GTL quarterly reporting (as of 2026-09-22).** This work
now sits on top of the `gtl-reports` branch, which reports on Global
Translation Leaders engagements using the same `Post`, `PromptVariantResponse`
and media tables. The two efforts independently built prayer-as-Posts and have
since converged: prayer is parented to the *engagement* with the report as an
attribution, `PostFilters.types` is the one shared filter, and the report-scoped
prayer resolver is gone. `docs/gtl-quarterly-reporting/ALIGNMENT.md` on the
`docs/gtl-quarterly-reporting-alignment` branch tracks what is settled and what
is still open between them — read it before changing anything on those shared
tables, because two report types now depend on them.

---

## Purpose & background

Field Partners submit a quarterly report per language engagement: team news,
a community story, photos/video/audio, prayer requests, a look at other
activities, and plans for next quarter. A subset of that content — one
story, a handful of media items, a few prayer items — gets curated into the
Investor Report, the communication that goes out to Seed Company's
financial supporters.

That curation isn't a straight copy. Content moves through a review
pipeline (translation, field-operations cleanup, a final investor-facing
pass) and a separate reach decision (is this cleared to leave Seed Company
at all, and how widely). This document specifies the fields, caps, and
moderation surfaces that let staff curate a report's Investor Report content
correctly and safely — plus the next phase under discussion, letting a
Field Partner hand Cord an existing report document instead of retyping it.

## Domain model at a glance

Two concepts recur through every requirement below and are worth fixing
precisely before reading further.

### The variant pipeline

Team News, the Community Story, Other Activities, and Next Quarter Plans
are each a **prompt** a Field Partner answers. Each prompt's answer exists
in up to four parallel drafts — one per stage of editorial work — called
**variants**. A field is "featured" or "published" by virtue of *which
variant* holds the content investors will see, not by a separate publish
flag.

| Stage | Variant | Responsible role |
|---|---|---|
| 1 | Partner | Field Partner |
| 2 | Translation | Translator |
| 3 | Field Operations | Project Manager |
| 4 | Investor Communications | Marketing |

Media (photos/video/audio) reuses this exact same variant list and the same
idea: uploading into the Investor Communications variant slot *is* the act
of including that item in the Investor Report. There's no separate
"select for publishing" control for media.

### The shareability ladder

Prayer requests (and any other free-text `Post`) carry a different,
orthogonal concept: how widely the author asked this to reach, versus how
widely a moderator actually cleared it. A moderator may only **narrow**
this, never widen it — clearing something wider than the author asked for
is a different act (approving reach the author never requested) and is
rejected outright.

| Reach | |
|---|---|
| Internal | narrowest |
| Ask to Share Externally | middle |
| External | widest |

Being curated into the Investor Report (`featured`) is a **third**,
independent decision layered on top of shareability: a post must already be
cleared to at least "Ask to Share Externally" before anyone can feature it,
but clearance alone doesn't feature it automatically.

---

## Requirements — shipped

Everything in this section exists in the reference implementation today.
Acceptance criteria describe required behavior, not the code shape that
produced it.

### REQ-01 — Final wording, distinct from the original submission

**Status:** Shipped

A moderator or translator can record the wording that will actually be
shown, without touching what the Field Partner originally wrote.

**Acceptance criteria**
- A post has both its original submitted text and a separate,
  independently editable "final wording" field.
- Final wording starts unset — the UI makes clear it "starts from the
  original" until someone saves an edit, rather than silently duplicating
  text a reader might mistake for already-reviewed.
- Editing final wording never overwrites or discards the original; audit
  history captures the as-submitted text at creation time regardless of
  later edits.
- Read access to final wording is available to anyone who can read the
  post; write access is role-gated (translator, project manager, regional
  director, field operations director, marketing) and separate from who
  may edit the original body.

### REQ-02 — Curate a prayer post into the Investor Report, capped at 3 per report

**Status:** Shipped

Staff mark specific prayer requests/updates/praises as part of this
quarter's Investor Report — not exclusive, but bounded.

**Acceptance criteria**
- A post can be flagged as curated into the Investor Report only if it is
  attached to a specific report *and* cleared to at least "Ask to Share
  Externally." Attempting either out of order fails with a specific,
  actionable message ("Only posts submitted with a report can be
  featured…" / "This post has not been cleared to leave Seed Company
  yet").
- A report may not have more than 3 posts curated at once. The 4th attempt
  is rejected with a specific message naming the limit, not a generic
  failure.
- Curating one post never un-curates another — multiple posts may be
  curated simultaneously, up to the cap.
- Only Project Manager and Marketing roles may set this flag; the
  permission is separate from who may moderate reach (clear/narrow
  shareability).

> **Why a cap, not just a permission:** The limit is a product decision
> about how much curated content an Investor Report should carry, not a
> data integrity rule — it belongs in application logic that can change,
> not a database constraint.

### REQ-03 — Exactly one community story featured per report

**Status:** Shipped

Unlike prayer content, a report has exactly one "the" investor-facing story
at a time — featuring a new one demotes whichever held it before.

**Acceptance criteria**
- Featuring story B when story A currently holds it atomically un-features
  A and features B — never a state with two (or zero, mid-operation)
  stories featured on the same report.
- The client that performed the action sees both the newly-featured story
  and the demoted story update, without a manual page refresh.
- A *second* viewer already looking at the same report — a different
  browser, a different user — also sees the demotion reflected without
  taking any action, within the normal live-update latency of the rest of
  the app.
- Only someone with edit access to a story's featured flag may attempt
  this; the exclusivity logic runs regardless of who triggers it.

> **Why this needed two separate fixes, not one:** "The database enforces
> exclusivity" and "every viewer sees it" are different guarantees. The
> reference implementation's first version got the database transaction
> right and still shipped a bug: the mutation told the calling client about
> the newly-featured story but not the demoted one, so a normalized client
> cache updated one side and left the other stale — visually
> indistinguishable from exclusivity not existing at all. A second,
> unrelated gap: the write path bypassed the ORM base class's automatic
> cache-invalidation, so *other* connected viewers never heard about either
> change. Treat "return every row that actually changed" and "invalidate
> every row that actually changed" as two separate acceptance criteria for
> any mutation that touches more than the one entity it's nominally "about,"
> because a fix for one does not imply the other.
>
> And a third, found later: the invalidation has to be keyed on the type the
> live-query store actually indexes under, which is the **GraphQL** type, not
> the domain subtype. The prompt-response subtypes are resource registrations
> with no `@ObjectType` of their own — every one of them resolves as
> `PromptVariantResponse` — so invalidating `ProgressReportCommunityStory:<id>`
> fired, logged, and matched nothing. A structural test that only asks
> "does this repository invalidate?" cannot catch that; it is file-granular,
> not key-aware. Verify the second-viewer criterion by actually opening a
> second session, not by reading the log line.

### REQ-04 — Investor Report media capped at 4 per report

**Status:** Shipped

The same "uploading into the Investor Communications variant is the
publish action" model as REQ-02, applied to photos/video/audio.

**Acceptance criteria**
- A report may not have more than 4 media items with content in the
  Investor Communications variant slot — whether that slot is filled by a
  fresh upload or by reusing a file already uploaded to an earlier
  variant.
- The 5th attempt, by either path, is rejected with a specific message
  naming the limit.
- The cap counts live (non-deleted) items only.

### REQ-05 — One moderation surface, reachable from two places

**Status:** Shipped

Reach clearance, final wording, and Investor Report curation live in a
single edit surface for a post — not duplicated, not scattered.

**Acceptance criteria**
- The same editing surface is reachable both from the report's own Prayer
  section *and* from wherever that same prayer post is referenced on the
  engagement's Prayer tab — same component, same behavior, not two
  implementations that can drift apart.
- Each control (clearance, final wording, curation) is shown only to
  someone who can act on it or who already has a value set for it worth
  seeing read-only; someone with no relevant permission and no existing
  value sees nothing extra.
- The Investor Report curation control is an unambiguous toggle (a
  switch), not a status indicator that happens to also be clickable — a
  badge that looks like a label reads as a label, not a control,
  regardless of whether a click handler is attached to it.

### REQ-06 — Read-only report view shows every section

**Status:** Shipped

Viewing a report shouldn't require entering edit mode to see what's
actually in it.

**Acceptance criteria**
- The non-edit report view surfaces, at minimum: workflow status,
  cumulative progress, team news, the community story (with the
  currently-featured one distinguishable from the others), a media summary
  including how many are in the Investor Report, every prayer item with
  its report-membership and Investor-Report/clearance status, other
  activities, and next-quarter plans.
- Each section links or defers into the corresponding edit step for anyone
  who needs to change it, rather than duplicating edit controls on the
  read view.

### REQ-07 — Rejected actions are never silent

**Status:** Shipped

Every control introduced by REQ-02 through REQ-05 must show the user why
an action failed, in context, at the moment it fails.

**Acceptance criteria**
- Hitting a cap, attempting to curate an uncleared post, or any other
  server-side rejection from these controls renders a specific,
  human-readable message next to the control that triggered it.
- A rejection never surfaces only as a browser console error or a generic
  toast with no actionable detail.

> **Why this needed its own pass:** The reference implementation's
> app-wide error handler deliberately suppresses this exact class of
> validation error from its generic toast, on the assumption the form
> shows it inline. Two controls fired their mutations outside of any
> form's submit lifecycle, so nothing ever did — every new cap or
> clearance rule silently failed to inform anyone until this was caught,
> live, by deliberately exceeding each cap during verification. Any new
> mutation triggered outside a form's own submit flow needs an explicit,
> local plan for showing its own errors; don't assume the app-wide handler
> has it covered.

---

## Requirements — planned (not yet built)

Field Partners already write these reports as prose documents. Rather than
requiring everyone to retype content directly into Cord, a Field Partner
(or PM on their behalf) should be able to upload that document and have it
pre-fill the report.

### REQ-08 — Upload a document to a report (v1: upload only, no email)

**Status:** Planned

A single Word document (.docx) attached to a specific report kicks off
extraction.

**Acceptance criteria**
- Upload reuses the existing file-upload pipeline; the source document is
  retained and linked to the report for reference.
- Only someone already authorized to edit that report may trigger intake
  for it.
- Email-based intake is explicitly out of scope for v1 — see Non-Goals.

### REQ-09 — Extract against the report's actual prompt catalog, not a fixed template

**Status:** Planned

Partners don't share one canonical document format, so extraction has to
work from what a prompt *means*, not from fixed headings.

**Acceptance criteria**
- The document is converted to text, segmented into candidate chunks, and
  each chunk is matched against the report's real, currently-available
  prompts (team news, this report's specific community-story prompts,
  other activities, next-quarter plans) plus two special categories:
  prayer content, and unmatched.
- Extraction never invents a prompt that doesn't exist in the catalog. A
  chunk that answers a known prompt not yet started on this report creates
  that prompt's response; a chunk the system isn't reasonably confident
  about is routed to unmatched rather than forced into a best guess.
- One low-confidence or failed chunk does not block the sections that
  matched cleanly — the result reports, per section, whether it was
  populated, routed to unmatched, or failed. No single pass/fail for the
  whole document.

### REQ-10 — Populate the Field Partner variant only — never further

**Status:** Planned

Extraction produces exactly what a Field Partner's own manual submission
would have produced. Nothing more.

**Acceptance criteria**
- Matched text is written into the Partner variant using the same
  creation and submission path a manual entry would use — never directly
  into Translation, Field Operations, or Investor Communications.
- Images embedded in the document are extracted and uploaded as media at
  the Partner variant, carrying any adjacent caption text.
- Prayer content becomes new prayer posts with the extracted text as the
  body. Shareability defaults to the narrowest available option;
  extraction never chooses a wider reach on the author's behalf.
- No content produced by this pipeline skips, weakens, or auto-advances
  through the existing moderation, translation, or curation pipeline
  (REQ-01 through REQ-07 apply identically to AI-populated content).

### REQ-11 — Visibly mark AI-populated fields

**Status:** Planned

A Field Partner reviewing the report must be able to tell what came from
their document versus what they typed themselves.

**Acceptance criteria**
- Any field populated by document intake carries a visible indicator
  distinguishing it from hand-typed content.
- The existing report edit wizard — the same steps a Field Partner already
  completes before submitting — is the review surface. No separate
  confirm-and-approve screen is required; pre-filled fields are edited in
  place like any other field.
- Exact marker treatment (a badge, a banner, whether it persists or clears
  once the field is edited) is open — see Open Questions.

---

## Platform constraints

Standing rules for this codebase that any implementation of the above —
regardless of internal structure — must respect.

- **Postgres/Drizzle only.** The platform is mid-migration off an older
  Neo4j-backed data layer. No new feature work may add Neo4j or Gel/EdgeDB
  code, even though a legacy dual-backend routing layer still exists for
  older, not-yet-migrated domains.
- **Caps and limits live in application logic, not database constraints.**
  They're product decisions (see REQ-02's rationale) that may change; a
  schema constraint makes that change a migration instead of a code
  review.
- **Any write path that bypasses the ORM's own base-class helpers must
  invalidate its own cache/live-query entries.** The reference
  implementation enforces this with an automated structural test that
  scans every repository file for writes and confirms each one either uses
  the invalidating base helpers or calls the invalidation API directly,
  with a named, reasoned exemption list for genuine exceptions. Port the
  enforcement mechanism, not just the rule — the failure mode (a page that
  quietly stops refreshing) is invisible in ordinary code review and
  ordinary tests. Note its limit, though: it is file-granular and checks
  only that a repository invalidates *something*, so it cannot tell a
  correct invalidation key from a wrong one (see the REQ-03 rationale).
- **A moderator may only narrow requested reach, never widen it.** Applies
  to shareability generally, not just prayer posts.
- **Validation errors render inline, at the point of the action that
  triggered them.** If the app has a generic/global error surface, treat
  it as a fallback for unexpected failures, not the primary channel for
  expected, user-facing validation messages.
- **GraphQL schema changes are additive.** Existing clients and generated
  types shouldn't need to change to keep working.

## Non-goals

- Email-based document intake — deferred until upload-based extraction
  quality is proven; treat as a distinct future project, not a v1 stretch
  goal (it needs sender-to-partner identity verification against a real
  mailbox, which is a meaningfully different and harder trust problem than
  an authenticated upload).
- The AI choosing shareability/reach on a partner's behalf, for prayer
  content or anything else.
- A bespoke review-and-approve screen for document intake, distinct from
  the normal report edit wizard.
- Reordering or prioritizing among multiple featured media/prayer items
  (the cap is a ceiling, not a ranking system).
- Retroactively enforcing the new caps against reports that may already
  exceed them from before this work existed (flagged, not decided — see
  Open Questions).

## Key decisions & rationale

Conclusions worth carrying into an implementation even where the
underlying code doesn't survive verbatim.

> **A mutation's response shape is part of its correctness.** Any mutation
> that can change more than the one entity it appears to be "about" must
> return every entity that actually changed — or otherwise give the client
> enough to know what else to refresh. A response that only describes the
> thing you asked to change is a data bug waiting to look like a UI bug.

> **Cache invalidation and response payload are two different
> obligations.** Fixing what a mutation returns fixes the calling client.
> It does nothing for every other client already looking at the same
> data. Any hand-rolled write path needs to satisfy both, and
> implementation should verify both independently rather than assuming one
> implies the other.

> **An invalidation that fires is not an invalidation that lands.** The key
> has to match what the live-query store indexes queries under — the GraphQL
> type name, which for a family of domain subtypes sharing one `@ObjectType`
> is the *shared* name, not the subtype's. A wrong key is indistinguishable
> from a right one in logs and in any test that only asserts "invalidate was
> called." This cost us a silently-unmet acceptance criterion; see REQ-03.

> **A toggle should look like a toggle.** A clickable status chip reads as
> a label first and a control second, if at all. Where an action is
> genuinely binary and user-triggered, use a control whose appearance says
> so.

> **Silence is the failure mode to design against.** Every new
> server-side rule (a cap, a precondition) needs a paired check, during
> build, that the failure path is actually visible to a user — not just
> that the rule is enforced. "The server rejects it correctly" and "the
> user finds out why" are separate acceptance criteria.

> **AI extraction should be a small pipeline, not one big prompt.**
> Segmenting a document and classifying each piece against a known, real
> catalog of prompts is safer than asking a model to read a whole document
> and emit one structured object — it bounds what the system can claim to
> have found, makes "I'm not sure" a first-class output instead of a
> forced guess, and lets one bad paragraph fail without taking the rest of
> the document down with it.

> **AI populates the same starting line a human would, never further.**
> Writing extracted content into the Partner variant — the same stage a
> manual submission starts at — means every existing safeguard
> (translation review, reach clearance, investor curation, all of REQ-01
> through REQ-07) applies to AI-sourced content automatically, with no
> special-casing. The trust problem is solved by *where* the content
> lands, not by how confident the extraction was.

## Reference implementation notes

Pointers into how REQ-01 through REQ-07 were actually built, for
orientation only. An implementation is expected to make its own structural
decisions; nothing here is a naming or architecture requirement.

| Concept | Reference location / shape |
|---|---|
| Prompt-based sections share one table family | Team News, Community Story, Other Activities, and Next Quarter Plans are all rows in one shared table, discriminated by a resource-type column; each prompt's per-variant text lives in a second table keyed by (response, variant). |
| Story exclusivity | A small, dedicated Postgres-only repository scoped to exactly this operation, run inside one transaction: read who currently holds it, clear everyone but the target, set the target, return every id whose value changed. |
| Prayer / free-text posts | A separate, more general entity from the prompt-response family — has no variant concept at all, just requested vs. approved shareability, an original body, a final wording, and the Investor Report flag. |
| Investor Report caps | Each cap backed by one small, dedicated count query on the relevant repository, injected directly into the service that enforces it — a repeated shape, not a shared generic "cap enforcer." |
| Live-query invalidation guard | An automated test that walks every repository source file, flags any that writes without either using the invalidating base-class helpers or calling the invalidation API directly, and requires a written reason for any legitimate exception. |
| Shared moderation UI | One dialog component used both from the report's own prayer step and from wherever a prayer post is surfaced elsewhere (e.g. an engagement's own prayer view), rather than two implementations of the same three controls. |

## Open questions

- **Extraction marker treatment.** Badge on the field, a banner on the
  whole step, or something else — and does it persist once the Field
  Partner edits the field, or clear immediately? Left to the implementer's
  judgment; only the requirement that *some* visible marker must exist is
  fixed (REQ-11).
- **Retroactive cap enforcement.** If any existing report already exceeds
  the new caps (from before REQ-02/REQ-04 existed), does it need a data
  migration, a one-time report, or nothing at all? Not decided.
- **PDF alongside .docx for intake.** Discussed as plausible but not
  committed for v1 — worth a call once the extraction utility is underway
  and the real conversion-library options are in front of you.
- **Are caps ever configurable per organization or program?** Today's
  numbers (1 story, 4 media, 3 prayer items) are fixed product decisions,
  not settings. Whether that ever needs to change is unaddressed.
