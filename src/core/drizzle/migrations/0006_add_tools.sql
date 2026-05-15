-- Migration: add tools table + tool_key enum.

CREATE TYPE "tool_key" AS ENUM ('Rev79');
--> statement-breakpoint

CREATE TABLE "tools" (
  "id"          text        PRIMARY KEY,
  "name"        text        NOT NULL UNIQUE,
  "description" text,
  "ai_based"    boolean     NOT NULL DEFAULT false,
  "key"         "tool_key",
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  "deleted_at"  timestamptz
);
--> statement-breakpoint

-- Partial unique: one active tool per machine identifier; NULLs allowed.
CREATE UNIQUE INDEX "tools_key_unique"
  ON "tools" ("key")
  WHERE "key" IS NOT NULL AND "deleted_at" IS NULL;
