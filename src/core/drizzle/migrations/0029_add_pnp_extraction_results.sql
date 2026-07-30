-- PnP Extraction Results (Phase 7, the last file-keyed domain). One result per
-- File (a LanguageEngagement.pnp or ProgressReport.reportFile); problems carry a
-- PnpProblemType uuid (severity + render live in code), a "Sheet!A1" source, and
-- a jsonb render context. Planning vs Progress flavor isn't stored — it's
-- resolved by the consuming field's type.

-- An extraction result has no life of its own without its File, so its lifetime
-- follows it. What CASCADE does and does not buy: file_nodes is SOFT-deleted, so
-- ordinary deletion sets deleted_at and this never fires — the result just
-- becomes unreachable, since every read arrives via the file. The cascade earns
-- its keep on a real DELETE (hard purge, rollback), and the FK itself is what
-- stops a result pointing at a file that does not exist. The problems table
-- already cascades from here, so the whole chain completes.
CREATE TABLE "pnp_extraction_results" (
  "file_id"    text PRIMARY KEY REFERENCES "file_nodes"("id") ON DELETE CASCADE,
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
