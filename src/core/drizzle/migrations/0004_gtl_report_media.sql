-- Media (photo, video, audio) attached to a GTL quarterly report.
--
-- Separate from `progress_report_media` rather than shared: that table is keyed
-- by (variant_group, variant) because a Momentum highlight is the same image
-- re-cut for four audiences. GTL media is not re-cut — a leader uploads photos
-- of a workshop and captions them — so a variant group here would be a column
-- that is always a group of one.
--
-- The category vocabulary IS shared; it is the same set of subjects, and the
-- investor portal reads both.
CREATE TABLE "gtl_report_media" (
  "id" text PRIMARY KEY NOT NULL,
  "report_id" text NOT NULL REFERENCES "periodic_reports"("id"),
  "category" "progress_report_media_category",
  "caption" text,
  -- DefinedFile placeholder, created by FileService after this row lands, so
  -- FK-less like every other defined-file column.
  "file_id" text,
  "creator_id" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "modified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "gtl_report_media_report_id_idx" ON "gtl_report_media" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "gtl_report_media_creator_id_idx" ON "gtl_report_media" USING btree ("creator_id");
