-- GTL goals become real, trackable goals owned by the engagement.
--
-- As first built, a goal was a string plus a rich-text note, owned by the
-- report that set it and reviewed exactly once by the following quarter. That
-- cannot express what a growth plan actually is: a goal with a target date two
-- or three quarters out, reported against every quarter along the way.
--
-- Three changes, in order of importance:
--
-- 1. OWNERSHIP MOVES TO THE ENGAGEMENT. A goal belongs to the Global
--    Translation Leader, not to one quarter's paperwork. `set_in_report_id`
--    survives as nullable provenance — "first proposed here" — so the timeline
--    the reports give is not lost.
--
-- 2. REAL TRACKING. Target completion date, plus a measurement axis copied
--    from the Growth Partners Activity already built on another branch:
--    Number (count toward a target), Percent (0-100), or Boolean (done / not
--    done). Keeping the two features' vocabulary identical matters more than
--    inventing a better one here.
--
-- 3. PROGRESS BECOMES A CHILD TABLE. `met`/`impact`/`reviewed_in_report_id`
--    allowed exactly one review per goal, forever. They are replaced by one
--    progress row per (goal, report), which is the same shape
--    `work_plan_report_activities` uses for the same reason.
--
-- The table is renamed to match: these are the engagement's goals, not the
-- report's.

ALTER TABLE "gtl_report_goals" RENAME TO "gtl_goals";--> statement-breakpoint

ALTER TABLE "gtl_goals" DROP CONSTRAINT "gtl_report_goals_review_shape_chk";--> statement-breakpoint
ALTER TABLE "gtl_goals" DROP CONSTRAINT "gtl_report_goals_distinct_reports_chk";--> statement-breakpoint

CREATE TYPE "gtl_goal_measurement" AS ENUM ('Number', 'Percent', 'Boolean');--> statement-breakpoint
CREATE TYPE "gtl_goal_status" AS ENUM (
  'Planned',
  'InProgress',
  'AtRisk',
  'OnHold',
  'Done',
  'Cancelled'
);--> statement-breakpoint

-- Backfilled from the setting report's engagement before being made NOT NULL,
-- so existing rows survive the move.
ALTER TABLE "gtl_goals" ADD COLUMN "engagement_id" text;--> statement-breakpoint

UPDATE "gtl_goals" g
SET "engagement_id" = pr."engagement_id"
FROM "periodic_reports" pr
WHERE pr."id" = g."set_in_report_id";--> statement-breakpoint

DELETE FROM "gtl_goals" WHERE "engagement_id" IS NULL;--> statement-breakpoint

ALTER TABLE "gtl_goals" ALTER COLUMN "engagement_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "gtl_goals"
  ADD CONSTRAINT "gtl_goals_engagement_id_engagements_id_fk"
  FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX "gtl_goals_engagement_id_idx" ON "gtl_goals" ("engagement_id");--> statement-breakpoint

-- Provenance, not ownership, from here on.
ALTER TABLE "gtl_goals" ALTER COLUMN "set_in_report_id" DROP NOT NULL;--> statement-breakpoint

ALTER TABLE "gtl_goals" ADD COLUMN "target_date" date;--> statement-breakpoint
ALTER TABLE "gtl_goals"
  ADD COLUMN "measurement" "gtl_goal_measurement" NOT NULL DEFAULT 'Boolean';--> statement-breakpoint
ALTER TABLE "gtl_goals" ADD COLUMN "target_number" integer;--> statement-breakpoint
ALTER TABLE "gtl_goals" ADD COLUMN "target_description" text;--> statement-breakpoint
ALTER TABLE "gtl_goals" ADD COLUMN "progress_value" integer;--> statement-breakpoint
ALTER TABLE "gtl_goals"
  ADD COLUMN "status" "gtl_goal_status" NOT NULL DEFAULT 'Planned';--> statement-breakpoint

-- A counted goal needs something to count toward; the other two measurements
-- derive their target (100, or done/not-done) and must not carry one.
ALTER TABLE "gtl_goals"
  ADD CONSTRAINT "gtl_goals_measurement_shape_chk" CHECK (
    ("measurement" = 'Number' AND "target_number" IS NOT NULL AND "target_number" > 0)
    OR ("measurement" <> 'Number' AND "target_number" IS NULL)
  );--> statement-breakpoint

-- The old single-review model.
ALTER TABLE "gtl_goals" DROP COLUMN "met";--> statement-breakpoint
ALTER TABLE "gtl_goals" DROP COLUMN "impact";--> statement-breakpoint
ALTER TABLE "gtl_goals" DROP COLUMN "reviewed_in_report_id";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- One progress entry per goal per report — how a quarter says what moved.
--
-- The goal's own `status`/`progress_value` are a cache of the most recent
-- entry by `progress_date`, written app-side in the same transaction, mirroring
-- how `work_plan_report_activities` drives its Activity. Backfilling an earlier
-- quarter therefore cannot regress the goal's current state.
CREATE TABLE "gtl_goal_progress" (
  "id"             text PRIMARY KEY,
  "goal_id"        text NOT NULL REFERENCES "gtl_goals"("id") ON DELETE CASCADE,
  "report_id"      text NOT NULL REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "status"         "gtl_goal_status" NOT NULL,
  -- Count for Number, 0-100 for Percent, unused for Boolean (status carries it).
  "progress_value" integer,
  "notes"          jsonb,
  "progress_date"  date NOT NULL,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "modified_at"    timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  "deleted_at"     timestamptz
);--> statement-breakpoint

CREATE UNIQUE INDEX "gtl_goal_progress_goal_report_active_unique"
  ON "gtl_goal_progress" ("goal_id", "report_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "gtl_goal_progress_goal_id_idx" ON "gtl_goal_progress" ("goal_id");--> statement-breakpoint
CREATE INDEX "gtl_goal_progress_report_id_idx" ON "gtl_goal_progress" ("report_id");
