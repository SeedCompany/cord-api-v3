-- Budget domain (Phase 5). One project has many budgets over its life;
-- exactly one is "Current" at a time (app-managed via the project workflow
-- transition hook). Records are per (partner org, fiscal year) within a
-- budget, synced from funding partnerships.
--
--   - universal_template_file_id is a deferred FK → files(id): plain text
--     because the budgets row is inserted before createDefinedFile makes the
--     file node (same ordering as partnerships.mou_id).
--   - The partial unique index backstops the service's record-uniqueness
--     check among live rows; soft-deleted records don't block recreation.

CREATE TYPE "budget_status" AS ENUM (
  'Pending',
  'Current',
  'Superceded',
  'Rejected'
);

CREATE TABLE "budgets" (
  "id"                          text PRIMARY KEY,
  "project_id"                  text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "status"                      "budget_status" NOT NULL DEFAULT 'Pending',
  "universal_template_file_id"  text,
  "created_at"                  timestamptz NOT NULL DEFAULT now(),
  "updated_at"                  timestamptz NOT NULL DEFAULT now(),
  "deleted_at"                  timestamptz
);

CREATE INDEX "budgets_project_id_idx" ON "budgets" ("project_id");

CREATE TABLE "budget_records" (
  "id"                   text PRIMARY KEY,
  "budget_id"            text NOT NULL REFERENCES "budgets"("id") ON DELETE CASCADE,
  "organization_id"      text NOT NULL REFERENCES "organizations"("id"),
  "fiscal_year"          integer NOT NULL,
  "amount"               double precision,
  "initial_amount"       double precision,
  "pre_approved_amount"  double precision,
  "created_at"           timestamptz NOT NULL DEFAULT now(),
  "updated_at"           timestamptz NOT NULL DEFAULT now(),
  "deleted_at"           timestamptz
);

CREATE UNIQUE INDEX "budget_records_budget_org_fy_active_unique"
  ON "budget_records" ("budget_id", "organization_id", "fiscal_year")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "budget_records_organization_id_idx"
  ON "budget_records" ("organization_id");
