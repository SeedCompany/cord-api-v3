-- Language domain (Phase 5, with Engagement). The user-settable sensitivity
-- lives here; effectiveSensitivity is computed at read time across engaging
-- projects. Engagement-derived fields (usesAIAssistance, presetInventory,
-- firstScriptureEngagement) are read-time queries against language_engagements
-- once that table lands (same phase).
--
-- Also attaches the deferred FK on ethnologue_languages.language_id (created
-- in 0007 before this table existed). Plain REFERENCES — no cascade — per the
-- soft-attachment / future-global-pool model documented on that table.

CREATE TABLE "languages" (
  "id"                                  text PRIMARY KEY,
  "name"                                text NOT NULL,
  "display_name"                        text NOT NULL,
  "display_name_pronunciation"          text,
  "sensitivity"                         "sensitivity" NOT NULL DEFAULT 'High',
  "is_dialect"                          boolean NOT NULL DEFAULT false,
  "population_override"                 integer,
  "registry_of_language_varieties_code" text,
  "least_of_these"                      boolean NOT NULL DEFAULT false,
  "least_of_these_reason"               text,
  "is_sign_language"                    boolean NOT NULL DEFAULT false,
  "sign_language_code"                  text,
  "sponsor_estimated_end_date"          date,
  "has_external_first_scripture"        boolean NOT NULL DEFAULT false,
  "tags"                                text[] NOT NULL DEFAULT '{}',
  "is_available_for_reporting"          boolean NOT NULL DEFAULT false,
  "created_at"                          timestamptz NOT NULL DEFAULT now(),
  "updated_at"                          timestamptz NOT NULL DEFAULT now(),
  "deleted_at"                          timestamptz
);

CREATE UNIQUE INDEX "languages_name_active_unique"
  ON "languages" ("name") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "languages_display_name_active_unique"
  ON "languages" ("display_name") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "languages_rolv_code_active_unique"
  ON "languages" ("registry_of_language_varieties_code")
  WHERE "registry_of_language_varieties_code" IS NOT NULL
    AND "deleted_at" IS NULL;

ALTER TABLE "ethnologue_languages"
  ADD CONSTRAINT "ethnologue_languages_language_id_fkey"
  FOREIGN KEY ("language_id") REFERENCES "languages"("id");

-- Full FK index — language_id's partial unique (live rows only) can't serve
-- FK-maintenance scans. Flagged by the postgres-schema.e2e invariant the
-- moment the REFERENCES above landed.
CREATE INDEX "ethnologue_languages_language_id_idx"
  ON "ethnologue_languages" ("language_id");
