-- GTL (Global Translation Leader) quarterly reports — #3966.
--
-- GTL is the Internship program under its new name, and its quarterly report is
-- the InternshipEngagement counterpart of the LanguageEngagement ProgressReport:
-- same cadence, same engagement parent, its own workflow. It is a new
-- `report_type` value on the shared `periodic_reports` table rather than a new
-- table, which is what gives it the per-quarter generation
-- (AbstractPeriodicReportSync), the live-interval dedup index and the
-- deterministic ids for free.
--
-- ENUM-IN-TRANSACTION HAZARD: drizzle's migrator runs every pending file in one
-- transaction, and Postgres refuses to USE an enum label added by
-- `ALTER TYPE ... ADD VALUE` until that transaction commits ("unsafe use of new
-- value"). The CHECK constraints below therefore compare `"type"::text` against
-- plain string literals wherever 'GTL' is involved — the cast makes it a text
-- comparison that never looks the new label up. (`CREATE TYPE` carries no such
-- restriction, so `gtl_report_status` is usable immediately.)
--
-- Deploy note: each ADD CONSTRAINT validates every existing periodic_reports
-- row under an ACCESS EXCLUSIVE lock. The table is small (one row per report
-- period), so this is a sub-second scan, but it does block writes while it runs.

ALTER TYPE "report_type" ADD VALUE 'GTL';--> statement-breakpoint

-- GTL's workflow status is its own enum, not `progress_report_status`: the two
-- agree on most states, but GTL adds `PendingSupervisorSignOff` — a state a
-- language-engagement report can never reach. Putting it on the shared enum
-- would surface it in the ProgressReport GraphQL enum, filters and stepper.
-- Declared in workflow order, matching `GtlReportStatus` in the app.
CREATE TYPE "gtl_report_status" AS ENUM (
  'NotStarted',
  'InProgress',
  'PendingSupervisorSignOff',
  'PendingTranslation',
  'InReview',
  'Approved',
  'Published'
);--> statement-breakpoint

-- Nullable: set exactly on GTL rows, the way `status` is set exactly on
-- Progress rows (see the status-shape constraint below).
ALTER TABLE "periodic_reports"
  ADD COLUMN "gtl_status" "gtl_report_status";--> statement-breakpoint

-- Postgres ANDs CHECK constraints, so a disjunct cannot be added to an existing
-- one — each is dropped and recreated. Existing rows keep exactly the shapes
-- they had; only the set of legal shapes grows.
--
-- Parent shape: Financial/Narrative hang off a project; Progress AND GTL hang
-- off an engagement.
ALTER TABLE "periodic_reports"
  DROP CONSTRAINT "periodic_reports_parent_shape_chk";--> statement-breakpoint

ALTER TABLE "periodic_reports"
  ADD CONSTRAINT "periodic_reports_parent_shape_chk" CHECK (
    ("type" IN ('Financial', 'Narrative') AND "project_id" IS NOT NULL AND "engagement_id" IS NULL)
    OR ("type"::text IN ('Progress', 'GTL') AND "engagement_id" IS NOT NULL AND "project_id" IS NULL)
  );--> statement-breakpoint

-- Status shape: `status` is set exactly when the type is Progress, `gtl_status`
-- exactly when it is GTL; Financial/Narrative rows carry neither.
ALTER TABLE "periodic_reports"
  DROP CONSTRAINT "periodic_reports_status_shape_chk";--> statement-breakpoint

ALTER TABLE "periodic_reports"
  ADD CONSTRAINT "periodic_reports_status_shape_chk" CHECK (
    ("status" IS NOT NULL) = ("type" = 'Progress')
    AND ("gtl_status" IS NOT NULL) = ("type"::text = 'GTL')
  );
