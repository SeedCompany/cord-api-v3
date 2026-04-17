CREATE TABLE IF NOT EXISTS "field_zones" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"director_id" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "field_zones_name_unique" UNIQUE("name")
);

CREATE TABLE IF NOT EXISTS "field_regions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"director_id" text,
	"field_zone_id" text NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "field_regions_name_unique" UNIQUE("name")
);

DO $$ BEGIN
 ALTER TABLE "field_regions" ADD CONSTRAINT "field_regions_field_zone_id_field_zones_id_fk" FOREIGN KEY ("field_zone_id") REFERENCES "public"."field_zones"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
