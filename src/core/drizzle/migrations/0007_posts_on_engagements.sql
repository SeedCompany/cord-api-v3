-- Prayer requests on engagements, shared by Progress and GTL reports — #3964.
--
-- Posts already attach to any Postable parent through the FK-less
-- parent_id/parent_type pair, so an engagement parent needs no DDL. What the
-- engagement feed adds is the moderation ladder and the report link:
--
-- `report_id`: the quarterly report a post was submitted with. Attribution,
-- not ownership — a prayer request lives on its engagement and losing the
-- report must not lose the post, hence SET NULL. The read path re-resolves a
-- soft-deleted report to the live row with the same period (see
-- PostRepository), because a report re-created after a date-range change gets a
-- fresh id and ON DELETE SET NULL never fires on a soft delete.
--
-- `approved_shareability` / `approved_by_id` / `approved_at`: how far a
-- moderator has cleared the post to reach. NULL means "nobody has looked",
-- which is distinct from a review that narrowed the reach. Existing rows never
-- went through moderation, so they are backfilled as cleared at what they
-- asked for — anything else would yank every historical post back to Internal.
--
-- `final_body`: the wording actually shown once the post leaves the author's
-- hands (a translation, a moderator's touch-up). A separate column so the
-- author's own words are never overwritten.
--
-- `featured`: curated into the report's Investor Report. Only meaningful with a
-- report; the service caps it at a few per report, so the partial index over
-- (report_id) WHERE featured is the lookup that cap runs.
--
-- Every foreign-key column gets its own full index (the FK-index invariant in
-- test/postgres-schema.e2e-spec.ts) — including approved_by_id, which an
-- earlier draft of this change forgot.

ALTER TABLE "posts" ADD COLUMN "report_id" text REFERENCES "periodic_reports"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "approved_shareability" "post_shareability";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "approved_by_id" text REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "approved_at" timestamptz;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "final_body" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "featured" boolean NOT NULL DEFAULT false;--> statement-breakpoint
UPDATE "posts" SET "approved_shareability" = "shareability", "approved_at" = "created_at" WHERE "approved_shareability" IS NULL;--> statement-breakpoint
CREATE INDEX "posts_report_id_idx" ON "posts" ("report_id");--> statement-breakpoint
CREATE INDEX "posts_approved_by_id_idx" ON "posts" ("approved_by_id");--> statement-breakpoint
CREATE INDEX "posts_awaiting_moderation_idx" ON "posts" ("parent_id") WHERE "approved_shareability" IS NULL;--> statement-breakpoint
CREATE INDEX "posts_featured_report_idx" ON "posts" ("report_id") WHERE "featured";
