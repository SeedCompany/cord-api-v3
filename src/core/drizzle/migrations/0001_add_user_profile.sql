-- Migration: expand users table with profile fields, add education/unavailability/system_agents

CREATE TYPE "gender" AS ENUM ('Male', 'Female');
CREATE TYPE "degree" AS ENUM ('Primary', 'Secondary', 'Associates', 'Bachelors', 'Masters', 'Doctorate');

-- Email becomes nullable (users may be created without one)
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "users"
  ADD COLUMN "real_first_name" text NOT NULL DEFAULT '',
  ADD COLUMN "real_last_name" text NOT NULL DEFAULT '',
  ADD COLUMN "display_first_name" text NOT NULL DEFAULT '',
  ADD COLUMN "display_last_name" text NOT NULL DEFAULT '',
  ADD COLUMN "phone" text,
  ADD COLUMN "timezone" text NOT NULL DEFAULT 'America/Chicago',
  ADD COLUMN "about" text,
  ADD COLUMN "title" text,
  ADD COLUMN "gender" "gender",
  ADD COLUMN "photo_id" text,
  ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN "deleted_at" timestamptz;
--> statement-breakpoint

CREATE TABLE "educations" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "degree" "degree" NOT NULL,
  "major" text NOT NULL,
  "institution" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
--> statement-breakpoint

CREATE TABLE "unavailabilities" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "description" text NOT NULL,
  "start" timestamptz NOT NULL,
  "end" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "unavailabilities_valid_range_chk" CHECK ("end" > "start")
);
--> statement-breakpoint

CREATE TABLE "system_agents" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "roles" text[] NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX "educations_user_id_idx" ON "educations" ("user_id");
CREATE INDEX "unavailabilities_user_id_idx" ON "unavailabilities" ("user_id");
