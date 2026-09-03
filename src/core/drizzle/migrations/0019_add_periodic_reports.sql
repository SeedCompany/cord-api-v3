-- Periodic Reports (Phase 5). Single table over FinancialReport /
-- NarrativeReport / ProgressReport. Financial+Narrative hang off projects;
-- Progress hangs off (language) engagements — the parent CHECK keeps the FK
-- coherent with the type. Ids are deterministic (sha256 of
-- parent:type:start:end, same derivation as Neo4j), so concurrent syncs
-- resolve via ON CONFLICT (id) DO NOTHING. No deleted_at: deletion is real
-- (eligible rows carry no user data, and a soft-deleted row would block the
-- deterministic id from being recreated when dates change back).
-- report_file_id / narrative_file_id are plain text, no FK — S4 class: the
-- createDefinedFile fan-out inserts this row before its file rows; real FKs
-- land with the S4 option-2 reorder at cutover cleanup. status is
-- ProgressReport-only, driven by the progress-report workflow.
--
-- SUPERSEDED BY 0035 — the two claims above about deletion no longer hold. That
-- migration adds `deleted_at`, so deletion became soft (matching Neo4j, whose own
-- delete relabels rather than removing), and moved the dedup guarantee off the
-- primary key onto `periodic_reports_live_interval_unique`, a partial unique index
-- over live rows. A revived interval therefore takes a FRESH id rather than being
-- blocked, and the insert's ON CONFLICT is deliberately untargeted because a
-- concurrent writer can lose on either constraint. Text above kept as the record
-- of what this migration did at the time.

CREATE TYPE "report_type" AS ENUM ('Financial', 'Narrative', 'Progress');

CREATE TYPE "progress_report_status" AS ENUM (
  'NotStarted',
  'InProgress',
  'PendingTranslation',
  'InReview',
  'Approved',
  'Published'
);

CREATE TABLE "periodic_reports" (
  "id"             text PRIMARY KEY,
  "type"           "report_type" NOT NULL,
  "project_id"     text REFERENCES "projects"("id") ON DELETE CASCADE,
  "engagement_id"  text REFERENCES "engagements"("id") ON DELETE CASCADE,
  "start"          date NOT NULL,
  "end"            date NOT NULL,
  "received_date"  date,
  "skipped_reason" text,
  "report_file_id" text,
  "narrative_file_id" text,
  "narrative_received_date" date,
  "status"         "progress_report_status",
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "periodic_reports_parent_shape_chk" CHECK (
    ("type" IN ('Financial', 'Narrative') AND "project_id" IS NOT NULL AND "engagement_id" IS NULL)
    OR ("type" = 'Progress' AND "engagement_id" IS NOT NULL AND "project_id" IS NULL)
  ),
  CONSTRAINT "periodic_reports_status_shape_chk" CHECK (
    ("type" = 'Progress') = ("status" IS NOT NULL)
  )
);

CREATE INDEX "periodic_reports_project_id_idx" ON "periodic_reports" ("project_id");
CREATE INDEX "periodic_reports_engagement_id_idx" ON "periodic_reports" ("engagement_id");
