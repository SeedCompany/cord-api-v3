-- GTL report written sections — #3969.
--
-- Two of the four sections (Community Impact and Highlights) ride the shared
-- prompt_variant_responses tables, told apart by `resource_type`, so they need
-- no DDL. The other two get their own tables:
--
-- `gtl_report_practicums`: the practicum and workshop involvement reported for
-- a quarter. Several rows per report, each three independent fields (what, a
-- mentor, outcomes), which is why it is a flat table rather than a prompt
-- response. Soft-deleted like the goals. Both foreign-key columns get a full
-- index (the FK-index invariant in test/postgres-schema.e2e-spec.ts).
--
-- `gtl_report_progress_explanations`: the Field Project Manager's confidential
-- read on how the internship is tracking. At most one per report, so the
-- primary key IS the report id and a write is an upsert — the same shape as
-- progress_report_variance_explanations. No soft delete: there is nothing to
-- "remove", only a current explanation to revise. The PK index covers the FK.
--
-- Fresh CREATE TYPE only; no ADD VALUE, so the enum is usable immediately.

CREATE TABLE "gtl_report_practicums" (
  "id" text PRIMARY KEY,
  "report_id" text NOT NULL REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "involvement" text NOT NULL,
  "mentor_id" text REFERENCES "users"("id"),
  "outcomes" jsonb,
  "order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "modified_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint
CREATE INDEX "gtl_report_practicums_report_id_idx" ON "gtl_report_practicums" ("report_id");--> statement-breakpoint
CREATE INDEX "gtl_report_practicums_mentor_id_idx" ON "gtl_report_practicums" ("mentor_id");--> statement-breakpoint
CREATE TYPE "gtl_progress_status" AS ENUM ('AheadOfSchedule', 'OnTrack', 'DelayedYetExpectedToCompleteOnTime', 'NeedsAChangeToPlan');--> statement-breakpoint
CREATE TABLE "gtl_report_progress_explanations" (
  "report_id" text PRIMARY KEY REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "status" "gtl_progress_status" NOT NULL,
  "context" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
