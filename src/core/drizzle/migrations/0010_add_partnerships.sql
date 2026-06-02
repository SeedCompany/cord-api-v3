-- Migration: add Partnership.
-- Plus the supporting `partnership_agreement_status` enum.
--
-- Settled design decisions (see migration_postgres.md):
--   - Single `partnerships` table with FKs to `projects` + `partners`.
--   - `mou_id` / `agreement_id` deferred FKs to `files` (Tier 7). Plain text
--     here; REFERENCES added when File migrates.
--   - Partial unique on (project_id, partner_id) for live rows — backstops
--     the duplicate check the Neo4j repo's verifyRelationshipEligibility
--     performs at the app layer.
--   - Partial unique on (project_id) where primary = true — DB-level
--     enforcement of "one primary partnership per project". App's
--     removePrimaryFromOtherPartnerships clears the existing flag in the
--     same transaction.
--   - PCR/Changeset is excluded from the migration; mou_*_override columns
--     live on the row directly. Date coalesce (override → parent project)
--     happens in the repo's toDto.

CREATE TYPE "partnership_agreement_status" AS ENUM (
  'NotAttached',
  'AwaitingSignature',
  'Signed'
);
--> statement-breakpoint

CREATE TABLE "partnerships" (
  "id"                       text                              PRIMARY KEY,
  "project_id"               text                              NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "partner_id"               text                              NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
  "agreement_status"         "partnership_agreement_status"    NOT NULL DEFAULT 'NotAttached',
  "mou_status"               "partnership_agreement_status"    NOT NULL DEFAULT 'NotAttached',
  -- migration-todo: deferred FK → files(id); add REFERENCES when File
  -- migrates (Tier 7). Plain text until then.
  "mou_id"                   text,
  "agreement_id"             text,
  "mou_start_override"       date,
  "mou_end_override"         date,
  "types"                    "partner_type"[]                  NOT NULL DEFAULT '{}',
  "financial_reporting_type" "financial_reporting_type",
  "primary"                  boolean                           NOT NULL DEFAULT false,
  "created_at"               timestamptz                       NOT NULL DEFAULT now(),
  "updated_at"               timestamptz                       NOT NULL DEFAULT now(),
  "deleted_at"               timestamptz
);
--> statement-breakpoint

-- One partnership per (project, partner) pair on live rows.
CREATE UNIQUE INDEX "partnerships_project_partner_active_unique"
  ON "partnerships" ("project_id", "partner_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- At most one primary partnership per project on live rows. DB-level
-- enforcement of the "one primary per project" invariant; app's
-- removePrimaryFromOtherPartnerships clears the flag elsewhere atomically.
CREATE UNIQUE INDEX "partnerships_project_primary_active_unique"
  ON "partnerships" ("project_id")
  WHERE "primary" = true AND "deleted_at" IS NULL;
--> statement-breakpoint

-- The composite unique above covers the leftmost column (project_id), but
-- partner-side lookups (e.g. "find partnerships for partner X") need their
-- own index.
CREATE INDEX "partnerships_partner_id_idx" ON "partnerships" ("partner_id");
--> statement-breakpoint

-- Deferred-FK columns indexed now to avoid CREATE INDEX CONCURRENTLY when
-- File migrates.
CREATE INDEX "partnerships_mou_id_idx"       ON "partnerships" ("mou_id");
--> statement-breakpoint
CREATE INDEX "partnerships_agreement_id_idx" ON "partnerships" ("agreement_id");
