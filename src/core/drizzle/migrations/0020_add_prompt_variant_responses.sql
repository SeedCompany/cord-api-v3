-- Prompt Variant Responses (Phase 5). Generic container shared by every
-- PromptVariantResponse subtype (ProgressReport team news / highlights /
-- community stories). resource_type is the concrete DTO name (stands in for
-- the Neo4j label); parent_id is intentionally FK-less — parents span tables
-- as domains migrate. Prompts are code-defined; only the chosen prompt id is
-- stored. Entries are one row per (response, variant): edits within the
-- permanent-after window update in place, later edits soft-delete and insert
-- (mirror of Neo4j's deactivate+create history chain).

CREATE TABLE "prompt_variant_responses" (
  "id"            text PRIMARY KEY,
  "resource_type" text NOT NULL,
  "parent_id"     text NOT NULL,
  "prompt"        text NOT NULL,
  "creator_id"    text NOT NULL REFERENCES "users"("id"),
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "modified_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"    timestamptz NOT NULL DEFAULT now(),
  "deleted_at"    timestamptz
);

CREATE INDEX "prompt_variant_responses_parent_id_idx"
  ON "prompt_variant_responses" ("parent_id");

CREATE TABLE "prompt_variant_response_entries" (
  "id"          bigserial PRIMARY KEY,
  "response_id" text NOT NULL REFERENCES "prompt_variant_responses"("id") ON DELETE CASCADE,
  "variant"     text NOT NULL,
  "response"    jsonb,
  "creator_id"  text NOT NULL REFERENCES "users"("id"),
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "modified_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at"  timestamptz
);

CREATE UNIQUE INDEX "prompt_variant_response_entries_response_variant_active_unique"
  ON "prompt_variant_response_entries" ("response_id", "variant")
  WHERE "deleted_at" IS NULL;

-- Full FK indexes (mono added these in later backfills; inline here).
CREATE INDEX "prompt_variant_responses_creator_id_idx" ON "prompt_variant_responses" ("creator_id");
CREATE INDEX "prompt_variant_response_entries_response_id_idx" ON "prompt_variant_response_entries" ("response_id");
CREATE INDEX "prompt_variant_response_entries_creator_id_idx" ON "prompt_variant_response_entries" ("creator_id");
