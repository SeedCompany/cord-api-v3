-- Backfill FK-column indexes on `locations` that predate the
-- index-every-FK standard (Postgres does not auto-index FK columns).
-- Flagged by the postgres-schema.e2e invariant ("indexes the leading column
-- of every foreign key"); names match mono's 0028_add_fk_indexes.

CREATE INDEX "locations_default_field_region_id_idx" ON "locations" ("default_field_region_id");
CREATE INDEX "locations_funding_account_id_idx" ON "locations" ("funding_account_id");
