-- Migration: let posts hang off an engagement, carry an optional quarterly
-- report reference, link to the post they update, and record a moderated reach.
--
-- Context: field partners are about to submit quarterly reports directly in
-- Cord, and prayer is part of that. Prayer arrives at roughly 1-2 items per
-- engagement per week, so it lives on the engagement continuously and a report
-- is a curation of it, not its home.
--
-- No change is needed for the Engagement parent itself: `parent_id` /
-- `parent_type` is a polymorphic pair with no FK, so accepting a new
-- `parent_type` is purely application-level (see engagement.dto.ts and the
-- membership hop added in post.drizzle.repository.ts).

-- ── The report reference ────────────────────────────────────────────────────
--
-- ON DELETE SET NULL, deliberately, and this is the whole reason the engagement
-- rather than the report is the Postable parent.
--
-- Reports are not stable objects. `sync-progress-report-to-engagement.handler`
-- creates and removes them as an engagement's date window moves, migration 0035
-- made that a soft delete precisely because a hard one was destroying media, and
-- `drop-internship-progress-reports.migration.ts` exists because a whole class
-- of them was created in error and had to be swept. A prayer request must
-- survive all of that: losing the report should lose the *attribution*, never
-- the prayer.
--
-- Typed against periodic_reports (not progress_reports, which is not a table --
-- ProgressReport is a `type` discriminator on periodic_reports) so the column
-- can serve any report kind later without a second migration.
ALTER TABLE "posts" ADD COLUMN "report_id" text
  REFERENCES "periodic_reports"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- ── Updates to an earlier post ──────────────────────────────────────────────
--
-- Real field prayer is conversational: "Answered Prayers: we thank God for
-- answering our previous prayer request by bringing peace..." is the dominant
-- shape in the existing data. Without a link, an aggregated engagement feed is
-- an undated pile in which nobody can tell what was answered.
--
-- Self-referential and nullable rather than a separate `post_updates` table: an
-- update IS a post -- same body, same shareability question, same moderation
-- path -- and giving it its own table would double every one of those.
--
-- ON DELETE SET NULL rather than CASCADE: deleting a request should orphan its
-- updates, not silently delete testimony that God answered something.
ALTER TABLE "posts" ADD COLUMN "responds_to_id" text
  REFERENCES "posts"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- ── Moderated reach ────────────────────────────────────────────────────────
--
-- Until now every post's reach was whatever its author set, which was safe only
-- because authors were all staff. Partners posting directly removes that
-- accident, and prayer is the worst possible place to lose it: these are
-- requests about people facing violence, illness and displacement, and several
-- of the sensitivity decisions are not the author's to make.
--
-- Modelled as an approved VALUE rather than an approved BOOLEAN. `shareability`
-- becomes what was requested; `approved_shareability` is what a moderator
-- cleared. Effective reach is `approved_shareability ?? min(shareability,
-- Internal)`, computed in the repository.
--
-- Why a value and not a flag: a flag forces a binary on a 5-value scale. A
-- moderator's most common real action is not yes-or-no but "not External, but
-- Internal is fine" -- which a flag cannot express, so it would either block
-- the post outright or leave the requested wide value standing while pending.
-- A nullable value also keeps "never reviewed" distinct from "reviewed and
-- deliberately narrowed to Internal", which a flag collapses.
--
-- Nothing is hidden by this. An unreviewed post is fully visible to staff and
-- team members immediately; only its external reach waits. So the default
-- degrades safely without making the feature feel broken to the people who need
-- to read it.
ALTER TABLE "posts" ADD COLUMN "approved_shareability" "post_shareability";
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "approved_by_id" text
  REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "approved_at" timestamptz;
--> statement-breakpoint

-- Existing rows are all staff-authored, so backfill them as already cleared at
-- the reach they were given. Without this every historical post would read as
-- awaiting review and the moderation queue would open with a backlog of
-- thousands that nobody asked for.
--
-- approved_by_id stays NULL for these: nobody actually reviewed them, and
-- inventing an approver would be a false audit record. A NULL approver with a
-- non-null approved_at reads correctly as "grandfathered".
UPDATE "posts"
  SET "approved_shareability" = "shareability",
      "approved_at" = "created_at"
  WHERE "approved_shareability" IS NULL;
--> statement-breakpoint

-- FK indexes. Both are read as filters, not just joined: the report's prayer
-- step lists by report_id, and grouping a request with its updates lists by
-- responds_to_id.
CREATE INDEX "posts_report_id_idx" ON "posts" ("report_id");
--> statement-breakpoint
CREATE INDEX "posts_responds_to_id_idx" ON "posts" ("responds_to_id");
--> statement-breakpoint

-- The moderation queue's only query: everything still awaiting review. Partial
-- on the null, because that is the entire predicate and the selective side --
-- once the backfill above lands, unreviewed rows are a small and self-limiting
-- set while reviewed rows grow without bound.
CREATE INDEX "posts_awaiting_moderation_idx" ON "posts" ("parent_id")
  WHERE "approved_shareability" IS NULL;
