-- Migration: add user_locations, language_locations, and project_other_locations
-- junction tables, mirroring organization_locations (migration 0003).

CREATE TABLE "user_locations" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "location_id" text NOT NULL REFERENCES "locations"("id") ON DELETE CASCADE,
  PRIMARY KEY ("user_id", "location_id")
);
--> statement-breakpoint

CREATE TABLE "language_locations" (
  "language_id" text NOT NULL REFERENCES "languages"("id") ON DELETE CASCADE,
  "location_id" text NOT NULL REFERENCES "locations"("id") ON DELETE CASCADE,
  PRIMARY KEY ("language_id", "location_id")
);
--> statement-breakpoint

CREATE TABLE "project_other_locations" (
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "location_id" text NOT NULL REFERENCES "locations"("id") ON DELETE CASCADE,
  PRIMARY KEY ("project_id", "location_id")
);
--> statement-breakpoint

-- FK indexes on the right side of composite PKs (the leftmost column is already covered)
CREATE INDEX "user_locations_location_id_idx" ON "user_locations" ("location_id");
CREATE INDEX "language_locations_location_id_idx" ON "language_locations" ("location_id");
CREATE INDEX "project_other_locations_location_id_idx" ON "project_other_locations" ("location_id");
