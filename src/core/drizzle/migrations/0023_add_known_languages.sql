-- Known Languages (Phase 6). A user's known languages at a proficiency
-- level. A user may know a language at more than one proficiency (the Neo4j
-- create only replaces the exact (user, language, proficiency) edge), so the
-- PK spans all three and create is an idempotent ON CONFLICT DO NOTHING.

CREATE TYPE "language_proficiency" AS ENUM (
  'Beginner', 'Conversational', 'Skilled', 'Fluent'
);

CREATE TABLE "known_languages" (
  "user_id"     text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "language_id" text NOT NULL REFERENCES "languages"("id") ON DELETE CASCADE,
  "proficiency" "language_proficiency" NOT NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "known_languages_pkey" PRIMARY KEY ("user_id", "language_id", "proficiency")
);

CREATE INDEX "known_languages_user_id_idx" ON "known_languages" ("user_id");
-- language_id is an FK but not the PK's leading column, so it needs its own
-- full b-tree index for FK-maintenance / cascade scans.
CREATE INDEX "known_languages_language_id_idx" ON "known_languages" ("language_id");
