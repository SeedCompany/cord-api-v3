-- Migration: add department_id_blocks + partners (+ field-region / country /
-- language-of-consulting junctions). One live Partner per Organization.
-- Language FKs are deferred (added when Language migrates).

CREATE TYPE "project_type" AS ENUM ('MomentumTranslation', 'MultiplicationTranslation', 'Internship');
--> statement-breakpoint
CREATE TYPE "partner_type" AS ENUM ('Managing', 'Funding', 'Impact', 'Technical', 'Resource');
--> statement-breakpoint
CREATE TYPE "financial_reporting_type" AS ENUM ('Funded', 'FieldEngaged', 'Hybrid');
--> statement-breakpoint

-- Finance::Department::IdBlock — shared by Partner (user-supplied) and later
-- FundingAccount (computed). `range` mirrors Gel's native int4multirange.
CREATE TABLE "department_id_blocks" (
  "id"       text             PRIMARY KEY,
  "range"    int4multirange   NOT NULL,
  "programs" "project_type"[] NOT NULL DEFAULT '{}'
);
--> statement-breakpoint

CREATE TABLE "partners" (
  "id"                                  text                         PRIMARY KEY,
  "organization_id"                     text                         NOT NULL REFERENCES "organizations"("id"),
  "point_of_contact_id"                 text                         REFERENCES "users"("id"),
  "types"                               "partner_type"[]             NOT NULL DEFAULT '{}',
  "financial_reporting_types"           "financial_reporting_type"[] NOT NULL DEFAULT '{}',
  "pmc_entity_code"                     text,
  "global_innovations_client"           boolean                      NOT NULL DEFAULT false,
  "active"                              boolean                      NOT NULL DEFAULT false,
  "address"                             text,
  -- migration-todo: deferred FK -> languages("id"); add REFERENCES when Language migrates
  "language_of_wider_communication_id"  text,
  "language_of_reporting_id"            text,
  "start_date"                          date,
  "approved_programs"                   "project_type"[]             NOT NULL DEFAULT '{}',
  "department_id_block_id"              text                         REFERENCES "department_id_blocks"("id"),
  -- migration-todo: derived from project sensitivity; 'High' until Project migrates
  "sensitivity"                         "sensitivity"                NOT NULL DEFAULT 'High',
  "created_at"                          timestamptz                  NOT NULL DEFAULT now(),
  "updated_at"                          timestamptz                  NOT NULL DEFAULT now(),
  "deleted_at"                          timestamptz
);
--> statement-breakpoint

-- One live Partner per Organization (Neo4j enforces this app-side via partnerIdByOrg).
CREATE UNIQUE INDEX "partners_organization_active_unique"
  ON "partners" ("organization_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "partners_point_of_contact_id_idx"                  ON "partners" ("point_of_contact_id");
--> statement-breakpoint
CREATE INDEX "partners_department_id_block_id_idx"               ON "partners" ("department_id_block_id");
--> statement-breakpoint
-- Indexes on deferred-FK columns — REFERENCES added when Language migrates;
-- the index goes in now so we avoid CREATE INDEX CONCURRENTLY later.
CREATE INDEX "partners_language_of_wider_communication_id_idx"   ON "partners" ("language_of_wider_communication_id");
--> statement-breakpoint
CREATE INDEX "partners_language_of_reporting_id_idx"             ON "partners" ("language_of_reporting_id");
--> statement-breakpoint

CREATE TABLE "partner_field_regions" (
  "partner_id"      text NOT NULL REFERENCES "partners"("id")      ON DELETE CASCADE,
  "field_region_id" text NOT NULL REFERENCES "field_regions"("id") ON DELETE CASCADE,
  PRIMARY KEY ("partner_id", "field_region_id")
);
--> statement-breakpoint
CREATE INDEX "partner_field_regions_field_region_id_idx" ON "partner_field_regions" ("field_region_id");
--> statement-breakpoint

CREATE TABLE "partner_countries" (
  "partner_id"  text NOT NULL REFERENCES "partners"("id")   ON DELETE CASCADE,
  "location_id" text NOT NULL REFERENCES "locations"("id")  ON DELETE CASCADE,
  PRIMARY KEY ("partner_id", "location_id")
);
--> statement-breakpoint
CREATE INDEX "partner_countries_location_id_idx" ON "partner_countries" ("location_id");
--> statement-breakpoint

CREATE TABLE "partner_languages_of_consulting" (
  "partner_id"  text NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
  -- migration-todo: deferred FK -> languages("id"); add REFERENCES when Language migrates
  "language_id" text NOT NULL,
  PRIMARY KEY ("partner_id", "language_id")
);
--> statement-breakpoint
-- Right-side index for "find partners consulting language X" — the composite
-- PK only covers the left side (partner_id).
CREATE INDEX "partner_languages_of_consulting_language_id_idx" ON "partner_languages_of_consulting" ("language_id");
