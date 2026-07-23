-- PnP Extraction Results (Phase 7, the last file-keyed domain). One result per
-- File (a LanguageEngagement.pnp or ProgressReport.reportFile); problems carry a
-- PnpProblemType uuid (severity + render live in code), a "Sheet!A1" source, and
-- a jsonb render context. Planning vs Progress flavor isn't stored — it's
-- resolved by the consuming field's type.

CREATE TABLE "pnp_extraction_results" (
  "file_id"    text PRIMARY KEY,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "pnp_extraction_result_problems" (
  "id"      text PRIMARY KEY,
  "file_id" text NOT NULL REFERENCES "pnp_extraction_results"("file_id") ON DELETE CASCADE,
  "type"    text NOT NULL,
  "source"  text NOT NULL,
  "context" jsonb NOT NULL
);

CREATE INDEX "pnp_extraction_result_problems_file_id_idx" ON "pnp_extraction_result_problems" ("file_id");
