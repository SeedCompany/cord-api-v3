-- Migration: add organizations, organization_locations, and user_organizations tables

CREATE TYPE "organization_type" AS ENUM ('Church', 'Parachurch', 'Mission', 'Translation', 'Alliance');
CREATE TYPE "organization_reach" AS ENUM ('Local', 'Regional', 'National', 'Global');
CREATE TYPE "sensitivity" AS ENUM ('Low', 'Medium', 'High');
--> statement-breakpoint

CREATE TABLE "organizations" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "acronym" text,
  "address" text,
  "types" "organization_type"[] NOT NULL DEFAULT '{}',
  "reach" "organization_reach"[] NOT NULL DEFAULT '{}',
  "sensitivity" "sensitivity" NOT NULL DEFAULT 'High',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
--> statement-breakpoint

CREATE TABLE "organization_locations" (
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "location_id" text NOT NULL REFERENCES "locations"("id") ON DELETE CASCADE,
  PRIMARY KEY ("organization_id", "location_id")
);
--> statement-breakpoint

CREATE TABLE "user_organizations" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "primary" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "organization_id")
);
--> statement-breakpoint

-- At most one primary org per user
CREATE UNIQUE INDEX "user_organizations_one_primary_per_user"
  ON "user_organizations" ("user_id")
  WHERE "primary" = true;

-- FK indexes on the right side of composite PKs (the leftmost column is already covered)
CREATE INDEX "organization_locations_location_id_idx" ON "organization_locations" ("location_id");
CREATE INDEX "user_organizations_organization_id_idx" ON "user_organizations" ("organization_id");
