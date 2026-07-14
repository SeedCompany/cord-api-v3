-- Backfill FK-column indexes on `locations` that predate the
-- index-every-FK standard (Postgres does not auto-index FK columns).
-- Flagged by the postgres-schema.e2e invariant ("indexes the leading column
-- of every foreign key"); names match mono's 0028_add_fk_indexes.

CREATE INDEX "locations_default_field_region_id_idx" ON "locations" ("default_field_region_id");
CREATE INDEX "locations_funding_account_id_idx" ON "locations" ("funding_account_id");

-- `partnerships.project_id` (FK, ON DELETE CASCADE) had no full b-tree index:
-- only the two partial uniques (`WHERE deleted_at IS NULL`) lead with it, and
-- Postgres can't use partial indexes for FK-maintenance scans (cascades must
-- consider soft-deleted rows too). Same gap class as project_members in 0010.
CREATE INDEX "partnerships_project_id_idx" ON "partnerships" ("project_id");
