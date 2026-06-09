-- Migration: add ethnologue_languages table.
--
-- EthnologueLanguage is currently created 1:1 alongside a Language, but the
-- schema preserves the path to the planned future model where these become
-- a global pool of canonical language records and `language_id` is a soft
-- attachment (new Languages hook into existing pool entries by code).
-- Concretely:
--   - `language_id` is NULLABLE (orphans are valid; pool entries pre-date
--     their attachment).
--   - When Language migrates in Phase 3&4 it adds `REFERENCES languages(id)
--     ON DELETE SET NULL` (not CASCADE — deleting a Language releases the
--     attachment, doesn't destroy the pool entry) + a btree index.
--   - `code` / `provisional_code` uniqueness is GLOBAL (not scoped to
--     attached rows) — the future pool requires globally unique codes.

CREATE TABLE "ethnologue_languages" (
  "id"               text        PRIMARY KEY,
  "language_id"      text,
  "code"             text,
  "provisional_code" text,
  "name"             text,
  "population"       integer,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now(),
  "deleted_at"       timestamptz,
  CONSTRAINT "ethnologue_languages_code_format_chk"
    CHECK ("code" IS NULL OR "code" ~ '^[a-z]{3}$'),
  CONSTRAINT "ethnologue_languages_provisional_code_format_chk"
    CHECK ("provisional_code" IS NULL OR "provisional_code" ~ '^[a-z]{3}$'),
  CONSTRAINT "ethnologue_languages_population_non_negative_chk"
    CHECK ("population" IS NULL OR "population" >= 0)
);
--> statement-breakpoint

-- One active EthnologueLanguage row per Language.
CREATE UNIQUE INDEX "ethnologue_languages_language_id_unique"
  ON "ethnologue_languages" ("language_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- Codes are unique among active rows; null codes don't collide.
CREATE UNIQUE INDEX "ethnologue_languages_code_unique"
  ON "ethnologue_languages" ("code")
  WHERE "code" IS NOT NULL AND "deleted_at" IS NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX "ethnologue_languages_provisional_code_unique"
  ON "ethnologue_languages" ("provisional_code")
  WHERE "provisional_code" IS NOT NULL AND "deleted_at" IS NULL;
