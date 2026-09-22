-- GTL (Global Translation Leader) quarterly narrative reports.
--
-- GTL is this codebase's `InternshipEngagement`. Its quarterly report is the
-- Momentum ProgressReport's sibling, not its extension: same cadence, same
-- parent shape, entirely different content. Rather than loosening the
-- Language-only gate on Progress reports — a deliberate Sept-2024 product
-- decision — a new `report_type` value carries the GTL report, so nothing about
-- Momentum's reports changes.
--
-- Reusing `periodic_reports` (instead of a standalone table) is what buys the
-- quarterly cadence: AbstractPeriodicReportSync generates one row per fiscal
-- quarter from the engagement's date range, `periodic_reports_live_interval_unique`
-- dedups them, and the "Q2 FY26" label falls out of start/end. A separate table
-- would have to rebuild all three.
--
-- ENUM-IN-TRANSACTION HAZARD: `ALTER TYPE ... ADD VALUE` and any *use* of the
-- new label cannot share a transaction, and drizzle's migrator runs each file in
-- one. The CHECKs below therefore compare `"type"::text = 'GTL'` rather than the
-- enum literal — a plain string comparison that never references the new label.
-- (`CREATE TYPE` carries no such restriction; only `ADD VALUE` does.)

ALTER TYPE "report_type" ADD VALUE 'GTL';--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- GTL's workflow status is its OWN enum, not the Momentum one.
--
-- The two flows agree on five states but diverge on one that matters:
-- `PendingSupervisorSignOff`. The GTL narrative template ends by sending the
-- report to the leader's on-the-ground supervisor for assessment, and that
-- sign-off gates review — so it is a state, not just a section.
--
-- Adding that value to the shared `progress_report_status` would surface it in
-- Momentum's GraphQL enum, its status dropdowns and its stepper, for a state
-- Momentum can never reach. A separate enum keeps the two workflows genuinely
-- independent; the cost is a second nullable status column, below.
--
-- `PendingTranslation` is kept: GTL narratives frequently arrive in a national
-- language, so the need is, if anything, stronger here than for Momentum.
-- Declared in workflow order — `sortingForEnumIndex` sorts by ordinal.
CREATE TYPE "gtl_report_status" AS ENUM (
  'NotStarted',
  'InProgress',
  'PendingSupervisorSignOff',
  'PendingTranslation',
  'InReview',
  'Approved',
  'Published'
);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Parent shape: GTL reports hang off an engagement, like Progress reports.
--
-- Postgres ANDs CHECK constraints, so a third disjunct can't be added — the
-- constraint is dropped and replaced. Existing rows keep exactly the semantics
-- they had; only the set of legal shapes grows.
ALTER TABLE "periodic_reports"
  DROP CONSTRAINT "periodic_reports_parent_shape_chk";--> statement-breakpoint

ALTER TABLE "periodic_reports"
  ADD CONSTRAINT "periodic_reports_parent_shape_chk" CHECK (
    ("type" IN ('Financial', 'Narrative') AND "project_id" IS NOT NULL AND "engagement_id" IS NULL)
    OR ("type" = 'Progress' AND "engagement_id" IS NOT NULL AND "project_id" IS NULL)
    OR ("type"::text = 'GTL' AND "engagement_id" IS NOT NULL AND "project_id" IS NULL)
  );--> statement-breakpoint

-- Second status column, mirroring `status`'s biconditional exactly one type
-- over. `periodic_reports_status_shape_chk` — `(type = 'Progress') = (status IS
-- NOT NULL)` — is deliberately NOT touched: a GTL row leaves `status` null and
-- satisfies it unchanged, so Momentum's constraint keeps the precise meaning it
-- has today.
ALTER TABLE "periodic_reports"
  ADD COLUMN "gtl_status" "gtl_report_status";--> statement-breakpoint

ALTER TABLE "periodic_reports"
  ADD CONSTRAINT "periodic_reports_gtl_status_shape_chk" CHECK (
    ("type"::text = 'GTL') = ("gtl_status" IS NOT NULL)
  );--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- The supervisor: the person overseeing the Global Translation Leader on the
-- ground. Distinct from the mentor (who develops them) and from the FPM (Seed
-- Company's own manager for the project).
--
-- Sits in the InternshipEngagement-only column block beside `mentor_id`, and is
-- deliberately NOT added to `engagements_type_shape_chk` — `mentor_id` isn't
-- either. The shape CHECK constrains only the columns that *identify* a subtype.
--
-- No ON DELETE clause (NO ACTION): an engagement shouldn't lose its supervisor
-- assignment because a user record went away. Same precedent as `mentor_id`.
ALTER TABLE "engagements"
  ADD COLUMN "supervisor_id" text REFERENCES "users"("id");--> statement-breakpoint

CREATE INDEX "engagements_supervisor_id_idx" ON "engagements" ("supervisor_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Goals — the report's spine, and the one table with real cross-report shape.
--
-- The FY27 template asks the leader to list next quarter's goals, then next
-- quarter asks them to restate those goals and say whether each was met. Storing
-- that as two independent sets would mean the same goal is typed twice and can
-- drift. Instead a goal is ONE row, owned by the report that SET it and updated
-- in place by the report that REVIEWED it — so "goals from previous quarter" is
-- a read, and the review writes back onto the original text.
--
-- `reviewed_in_report_id` is ON DELETE SET NULL, not CASCADE: hard-deleting the
-- reviewing report should un-review the goal, never destroy it. (Reports soft-
-- delete in practice — see 0035 — so this is a backstop.)
--
-- NOTE for read paths: a report revived after a window change comes back with a
-- FRESH id (0035), so goals can point at a soft-deleted report. Both report
-- joins must filter `deleted_at IS NULL`, not just the driving side.
CREATE TABLE "gtl_report_goals" (
  "id"                    text PRIMARY KEY,
  "set_in_report_id"      text NOT NULL REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "reviewed_in_report_id" text REFERENCES "periodic_reports"("id") ON DELETE SET NULL,
  "goal"                  text NOT NULL,
  -- "Describe goal details: where, when, and how" — rich text.
  "details"               jsonb,
  -- The template numbers goals 1./2./3.; `order` drives display, mirroring
  -- activities.order rather than relying on insertion order.
  "order"                 integer NOT NULL DEFAULT 0,
  -- Review data. Null until the following quarter's report fills it in.
  "met"                   boolean,
  "impact"                jsonb,
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  "modified_at"           timestamptz NOT NULL DEFAULT now(),
  "updated_at"            timestamptz NOT NULL DEFAULT now(),
  "deleted_at"            timestamptz,
  -- Review data only exists once a reviewing report is named.
  CONSTRAINT "gtl_report_goals_review_shape_chk" CHECK (
    "reviewed_in_report_id" IS NOT NULL OR ("met" IS NULL AND "impact" IS NULL)
  ),
  -- A goal cannot be reviewed by the report that set it.
  CONSTRAINT "gtl_report_goals_distinct_reports_chk" CHECK (
    "reviewed_in_report_id" IS NULL OR "reviewed_in_report_id" <> "set_in_report_id"
  )
);--> statement-breakpoint

CREATE INDEX "gtl_report_goals_set_in_report_id_idx" ON "gtl_report_goals" ("set_in_report_id");--> statement-breakpoint
CREATE INDEX "gtl_report_goals_reviewed_in_report_id_idx" ON "gtl_report_goals" ("reviewed_in_report_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Practicum and workshop involvement.
--
-- Its own table rather than a PromptVariantResponse because a row is three
-- independent fields, one of which is a person — PVR holds exactly one rich-text
-- answer per audience variant and has nowhere to put a mentor.
--
-- `mentor_id` has no ON DELETE clause (defaults to NO ACTION), matching every
-- other optional user reference in this schema: a report shouldn't lose its
-- content because a user record went away.
CREATE TABLE "gtl_report_practicums" (
  "id"          text PRIMARY KEY,
  "report_id"   text NOT NULL REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "involvement" text NOT NULL,
  "mentor_id"   text REFERENCES "users"("id"),
  "outcomes"    jsonb,
  "order"       integer NOT NULL DEFAULT 0,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "modified_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  "deleted_at"  timestamptz
);--> statement-breakpoint

CREATE INDEX "gtl_report_practicums_report_id_idx" ON "gtl_report_practicums" ("report_id");--> statement-breakpoint
CREATE INDEX "gtl_report_practicums_mentor_id_idx" ON "gtl_report_practicums" ("mentor_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Explanation of Progress — the FPM's assessment, Field Ops only.
--
-- Wording is taken verbatim from the Stage III template, which is the only place
-- it has ever been written down; the current FY27 template dropped the section
-- entirely, so Cord becomes its system of record.
--
-- Four values, not the three the discovery notes described: "behind" splits into
-- a recoverable case and one that triggers the Change to Plan process, and that
-- distinction is the whole point of the field.
--
-- A pgEnum rather than text[]: unlike the Momentum variance reasons this is a
-- single closed choice that gates behaviour, with no deprecation story.
--
-- Shape mirrors progress_report_variance_explanations exactly: at most one per
-- report, PK on report_id so writes are a plain upsert, no soft delete (clearing
-- an explanation means deleting the row; it dies with its report via CASCADE).
CREATE TYPE "gtl_progress_status" AS ENUM (
  'AheadOfSchedule',
  'OnTrack',
  'DelayedYetExpectedToCompleteOnTime',
  'NeedsAChangeToPlan'
);--> statement-breakpoint

CREATE TABLE "gtl_report_progress_explanations" (
  "report_id"  text PRIMARY KEY REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "status"     "gtl_progress_status" NOT NULL,
  -- "If ahead of schedule, delayed, or needing change to plan, please give
  -- context." Optional at the DB level; the app requires it for non-OnTrack.
  "context"    jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- The supervisor's assessment. One per report, so PK on report_id.
--
-- `supervisor_id` records who the assessment is ATTRIBUTED to, which is not
-- necessarily who executed the sign-off transition: the FPM may enter it on the
-- supervisor's behalf. The transition's actor is in the workflow event; this is
-- the author. It defaults from `engagements.supervisor_id` but is snapshotted
-- here, because the engagement's supervisor can change between quarters and a
-- filed assessment should keep saying who wrote it.
--
-- Confidential — Field Ops and the assigned supervisor only. That is a policy
-- concern, not a schema one; no column encodes it.
CREATE TABLE "gtl_report_supervisor_assessments" (
  "report_id"     text PRIMARY KEY REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "supervisor_id" text REFERENCES "users"("id"),
  "assessment"    jsonb,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "updated_at"    timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX "gtl_report_supervisor_assessments_supervisor_id_idx"
  ON "gtl_report_supervisor_assessments" ("supervisor_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Transcript — an optional file plus its explanatory note. Confidential.
--
-- One per report, so PK on report_id, same posture as the sections above.
-- `file_id` is a DefinedFile placeholder with no FK: the row is inserted before
-- FileService.createDefinedFile fans out the file nodes, the same deferred-FK
-- class as periodic_reports.report_file_id / narrative_file_id.
-- migration-todo(cutover-cleanup): real FK to file_nodes with the S4 reorder.
CREATE TABLE "gtl_report_transcripts" (
  "report_id"   text PRIMARY KEY REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "file_id"     text,
  "explanation" jsonb,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Append-only status-transition history, mirroring
-- progress_report_workflow_events. A separate table because its `status` column
-- is the GTL enum — sharing the Momentum table would mean sharing the enum, and
-- that is exactly what the separate enum above exists to avoid.
--
-- Immutable facts: no soft delete, no `updated_at`. `transition_key` is null
-- when the workflow was bypassed and the status set directly. As in the Momentum
-- table, no trigger syncs the parent's status; it is written app-side in the
-- same transaction.
CREATE TABLE "gtl_report_workflow_events" (
  "id"             text PRIMARY KEY,
  "report_id"      text NOT NULL REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "who"            text NOT NULL REFERENCES "users"("id"),
  "status"         "gtl_report_status" NOT NULL,
  "transition_key" text,
  "notes"          jsonb,
  "at"             timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

-- Lists read oldest-first; the leading column also serves FK-maintenance scans.
CREATE INDEX "gtl_report_workflow_events_report_id_at_idx" ON "gtl_report_workflow_events" ("report_id", "at");--> statement-breakpoint
CREATE INDEX "gtl_report_workflow_events_who_idx" ON "gtl_report_workflow_events" ("who");
