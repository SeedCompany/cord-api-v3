-- Product Progress + Progress Summaries (Phase 5). product_progress exists
-- once any step progress is reported for a (product, report, variant);
-- step_progress rows hang off it and unreported steps surface as placeholders
-- at read time, ordered by the product's declared steps. progress_summaries
-- holds the PnP-extracted planned/actual figures per (report, period) — the
-- write path is the extractor (File domain, Phase 7); reads serve the
-- ProgressReport summary fields.

CREATE TABLE "product_progress" (
  "id"         text PRIMARY KEY,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "report_id"  text NOT NULL REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "variant"    text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "product_progress_product_report_variant_unique"
  ON "product_progress" ("product_id", "report_id", "variant");
CREATE INDEX "product_progress_report_id_idx" ON "product_progress" ("report_id");

CREATE TABLE "step_progress" (
  "id"          text PRIMARY KEY,
  "progress_id" text NOT NULL REFERENCES "product_progress"("id") ON DELETE CASCADE,
  -- product_step enum (0018) — matches the sibling products.steps column;
  -- mono kept text only because its chain had no product_step type.
  "step"        "product_step" NOT NULL,
  "completed"   double precision,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "step_progress_progress_step_unique"
  ON "step_progress" ("progress_id", "step");

CREATE TYPE "summary_period" AS ENUM ('ReportPeriod', 'FiscalYearSoFar', 'Cumulative');

CREATE TABLE "progress_summaries" (
  "id"         bigserial PRIMARY KEY,
  "report_id"  text NOT NULL REFERENCES "periodic_reports"("id") ON DELETE CASCADE,
  "period"     "summary_period" NOT NULL,
  "planned"    double precision NOT NULL,
  "actual"     double precision NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "progress_summaries_report_period_unique"
  ON "progress_summaries" ("report_id", "period");
