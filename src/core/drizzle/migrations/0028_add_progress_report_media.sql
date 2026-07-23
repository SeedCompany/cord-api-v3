-- Progress Report Media (Phase 7). Image/video/audio attached to a
-- ProgressReport, one row per variant; rows sharing variant_group_id are the
-- same image across variants. file_id is a DefinedFile placeholder (created by
-- FileService after the row, so no FK here, like other defined-file columns);
-- the media sidecar is reached via that file's latest FileVersion. The Neo4j
-- VariantGroup node collapses to a plain variant_group_id column.

CREATE TYPE "progress_report_media_category" AS ENUM (
  'Team', 'WorkInProgress', 'CommunityEngagement', 'LifeInCommunity',
  'Events', 'SceneryLandscape', 'Other'
);

CREATE TABLE "progress_report_media" (
  "id"                text PRIMARY KEY,
  "report_id"         text NOT NULL REFERENCES "periodic_reports"("id"),
  "variant"           text NOT NULL,
  "category"          "progress_report_media_category",
  "variant_group_id"  text NOT NULL,
  "file_id"           text,
  "creator_id"        text NOT NULL REFERENCES "users"("id"),
  "created_at"        timestamptz NOT NULL DEFAULT now(),
  "deleted_at"        timestamptz
);

CREATE INDEX "progress_report_media_report_id_idx" ON "progress_report_media" ("report_id");
CREATE INDEX "progress_report_media_variant_group_id_idx" ON "progress_report_media" ("variant_group_id");
CREATE INDEX "progress_report_media_creator_id_idx" ON "progress_report_media" ("creator_id");
