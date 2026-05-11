-- Migration: add field_zones + field_regions tables; backfill locations.default_field_region_id FK

CREATE TABLE "field_zones" (
  "id"          text        PRIMARY KEY,
  "name"        text        NOT NULL UNIQUE,
  "director_id" text        NOT NULL REFERENCES "users"("id"),
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  "deleted_at"  timestamptz
);
--> statement-breakpoint

CREATE TABLE "field_regions" (
  "id"            text        PRIMARY KEY,
  "name"          text        NOT NULL UNIQUE,
  "field_zone_id" text        NOT NULL REFERENCES "field_zones"("id"),
  "director_id"   text        NOT NULL REFERENCES "users"("id"),
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "updated_at"    timestamptz NOT NULL DEFAULT now(),
  "deleted_at"    timestamptz
);
--> statement-breakpoint

CREATE INDEX "field_zones_director_id_idx"     ON "field_zones"   ("director_id");
CREATE INDEX "field_regions_field_zone_id_idx" ON "field_regions" ("field_zone_id");
CREATE INDEX "field_regions_director_id_idx"   ON "field_regions" ("director_id");
--> statement-breakpoint

-- Backfill the FK that was deferred in 0002_add_locations.sql
ALTER TABLE "locations"
  ADD CONSTRAINT "locations_default_field_region_id_fkey"
  FOREIGN KEY ("default_field_region_id") REFERENCES "field_regions"("id");
