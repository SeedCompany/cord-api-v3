-- Progress report workflow: the append-only status-transition history, plus the
-- single variance explanation a report can carry.
--
-- Both hang off `periodic_reports` rows with `type = 'Progress'`. That's not
-- expressible as an FK (the CHECK on periodic_reports guarantees the shape but
-- can't be referenced), so the FK targets `periodic_reports(id)` and the repos
-- are the ones that only ever address Progress rows. Same posture as the
-- existing progress_report_media / progress_summaries tables.

-- ---------------------------------------------------------------------------
-- Variance explanation — at most ONE per report.
--
-- Neo4j reaches this through a MERGE on `(report)-[:varianceExplanation]->()`,
-- so writes are an upsert and a report can never accumulate two. A PK on
-- report_id encodes exactly that, and makes the Drizzle write a plain
-- ON CONFLICT rather than a read-then-branch.
--
-- `reasons` is text[], NOT an enum, deliberately: the allowed values live in
-- `ProgressReportVarianceExplanationReasonOptions`, which is a plain app-level
-- option set built for churn — it has an explicit `deprecated` list whose whole
-- purpose is to keep OLD values readable while blocking them for new writes.
-- A pgEnum would need a migration per wording change and couldn't express
-- "readable but not writable" at all. The values are also full sentences, not
-- labels. App-level `@IsIn` validation stays the gate.
--
-- No soft delete: this row isn't independently deletable in Neo4j either —
-- clearing an explanation means writing empty reasons + null comments. It dies
-- with its report via CASCADE.
CREATE TABLE "progress_report_variance_explanations" (
  "report_id"  text PRIMARY KEY REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "reasons"    text[] NOT NULL DEFAULT '{}',
  "comments"   jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Workflow events — append-only history, mirroring project_workflow_events
-- (created in 0010, later altered by 0031) closely enough that the two read the
-- same way.
--
-- Differences from the Project analogue, both driven by the DTO:
--   * one `status` column, not from_step/to_step. ProgressReportWorkflowEvent
--     exposes only the resulting `status`; the previous one is whatever the
--     preceding event said, so storing a `from` would be derivable-and-
--     therefore-driftable.
--   * `transition_key` nullable — null means the workflow was bypassed
--     (an admin setting status directly). The DTO documents this as
--     "null if workflow was bypassed".
--
-- No soft delete and no `updated_at`: events are immutable facts. Nothing in
-- the service surface updates or deletes one.
--
-- migration-todo(cutover-cleanup): `periodic_reports.status` is maintained by
-- the app (`changeStatus`), not by a trigger off this table — unlike
-- project_workflow_events, which syncs `projects.step` via
-- `sync_project_step_from_event`. Kept app-side to stay faithful to Neo4j for
-- the migration; promoting it to a trigger is a DB-invariants-pass candidate
-- (see the tracker's post-cutover DB-invariants row).
CREATE TABLE "progress_report_workflow_events" (
  "id"             text PRIMARY KEY,
  "report_id"      text NOT NULL REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "who"            text NOT NULL REFERENCES "users"("id"),
  "status"         "progress_report_status" NOT NULL,
  "transition_key" text,
  "notes"          jsonb,
  "at"             timestamptz NOT NULL DEFAULT now()
);

-- Every list query is "events for report X, oldest first" (the Neo4j repo sorts
-- createdAt ASC), so index that direction rather than the DESC the Project
-- analogue uses.
CREATE INDEX "progress_report_workflow_events_report_id_at_idx"
  ON "progress_report_workflow_events" ("report_id", "at");
CREATE INDEX "progress_report_workflow_events_who_idx"
  ON "progress_report_workflow_events" ("who");
