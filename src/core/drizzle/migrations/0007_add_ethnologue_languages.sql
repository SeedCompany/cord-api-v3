-- Migration: add ethnologue_languages table.
--
-- EthnologueLanguage is a 1:1 sub-record of Language. The `language_id`
-- column is a logical FK only until Language migrates in Phase 3&4, at which
-- point the `REFERENCES languages(id) ON DELETE CASCADE` clause + a btree
-- index on `language_id` get added in Language's migration.

CREATE TABLE "ethnologue_languages" (
  "id"               text        PRIMARY KEY,
  "language_id"      text        NOT NULL,
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
