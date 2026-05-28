-- Migration: add funding_accounts table; backfill locations.funding_account_id FK

CREATE TABLE "funding_accounts" (
  "id"             text        PRIMARY KEY,
  "name"           text        NOT NULL,
  "account_number" integer     NOT NULL,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  "deleted_at"     timestamptz,
  CONSTRAINT "funding_accounts_account_number_range_chk"
    CHECK ("account_number" >= 0 AND "account_number" <= 9)
);
--> statement-breakpoint

-- Partial unique index: name uniqueness only enforced for live (non-soft-deleted) rows.
CREATE UNIQUE INDEX "funding_accounts_name_active_unique"
  ON "funding_accounts" ("name") WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- Backfill the FK that was deferred in 0002_add_locations.sql
ALTER TABLE "locations"
  ADD CONSTRAINT "locations_funding_account_id_fkey"
  FOREIGN KEY ("funding_account_id") REFERENCES "funding_accounts"("id");
