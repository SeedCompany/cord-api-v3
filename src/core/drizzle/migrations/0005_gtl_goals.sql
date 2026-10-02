-- GTL goals and quarterly progress — #3968.
--
-- A Global Translation Leader's goals belong to the engagement, not to one
-- quarter's report: a goal with a target date several quarters out is
-- reported against every quarter along the way. `set_in_report_id` only
-- records where it was first proposed, so losing that report leaves the goal
-- standing (SET NULL).
--
-- `gtl_goal_progress` is one quarter's statement about one goal. A report says
-- one thing about a goal, so the partial unique index allows one LIVE entry per
-- (goal, report); re-saving the same quarter upserts in place against it.
--
-- The goal's current status and value are NOT cached on `gtl_goals`. They are
-- derived at read time from the latest live entry on a live report, so a
-- soft-deleted entry or report can never leave a stale value behind. The
-- `status` column is the goal's own initial/manual state and the fallback when
-- no entry exists.
--
-- The measurement-shape CHECK mirrors the service rule: a goal counted toward a
-- target (Number) needs a target number above zero and a non-blank description
-- of what is counted; the other measurements derive their target and carry no
-- number. The app checks first so the error names the field; the constraint is
-- the backstop.
--
-- Every foreign-key column gets its own full index (the FK-index invariant in
-- test/postgres-schema.e2e-spec.ts). The partial unique index over (goal_id,
-- report_id) does NOT count for goal_id — a partial index can't serve the
-- FK-maintenance scan — hence the separate plain index on it.
--
-- Fresh CREATE TYPEs only; no ADD VALUE, so none of 0003's in-transaction
-- hazard applies and both enums are usable immediately.

CREATE TYPE "gtl_goal_measurement" AS ENUM ('Number', 'Percent', 'Boolean');--> statement-breakpoint
CREATE TYPE "gtl_goal_status" AS ENUM ('Planned','InProgress','AtRisk','OnHold','Done','Cancelled');--> statement-breakpoint
CREATE TABLE "gtl_goals" (
  "id" text PRIMARY KEY,
  "engagement_id" text NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "set_in_report_id" text REFERENCES "periodic_reports"("id") ON DELETE SET NULL,
  "goal" text NOT NULL,
  "details" jsonb,
  "target_date" date,
  "measurement" "gtl_goal_measurement" NOT NULL DEFAULT 'Boolean',
  "target_number" integer,
  "target_description" text,
  "status" "gtl_goal_status" NOT NULL DEFAULT 'Planned',
  "order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "modified_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "gtl_goals_measurement_shape_chk" CHECK (
    ("measurement" = 'Number' AND "target_number" > 0 AND nullif(btrim("target_description"), '') IS NOT NULL)
    OR ("measurement" <> 'Number' AND "target_number" IS NULL)
  )
);--> statement-breakpoint
CREATE INDEX "gtl_goals_engagement_id_idx" ON "gtl_goals" ("engagement_id");--> statement-breakpoint
CREATE INDEX "gtl_goals_set_in_report_id_idx" ON "gtl_goals" ("set_in_report_id");--> statement-breakpoint
CREATE TABLE "gtl_goal_progress" (
  "id" text PRIMARY KEY,
  "goal_id" text NOT NULL REFERENCES "gtl_goals"("id") ON DELETE CASCADE,
  "report_id" text NOT NULL REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "status" "gtl_goal_status" NOT NULL,
  "progress_value" integer,
  "notes" jsonb,
  "progress_date" date NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "modified_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint
CREATE UNIQUE INDEX "gtl_goal_progress_goal_report_active_unique" ON "gtl_goal_progress" ("goal_id","report_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "gtl_goal_progress_goal_id_idx" ON "gtl_goal_progress" ("goal_id");--> statement-breakpoint
CREATE INDEX "gtl_goal_progress_report_id_idx" ON "gtl_goal_progress" ("report_id");
