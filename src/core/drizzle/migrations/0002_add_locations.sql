CREATE TYPE location_type AS ENUM (
  'Country',
  'City',
  'County',
  'Region',
  'State',
  'CrossBorderArea'
);

CREATE TABLE locations (
  id                          text PRIMARY KEY,
  name                        text NOT NULL,
  type                        location_type NOT NULL,
  iso_alpha3                  text,
  funding_account_id          text,
  default_field_region_id     text,
  default_marketing_region_id text REFERENCES locations(id),
  map_image_id                text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz
);

-- Partial unique indexes: uniqueness only enforced for live (non-soft-deleted) rows,
-- so a soft-deleted record does not block reuse of its name/iso_alpha3.
CREATE UNIQUE INDEX "locations_name_active_unique"
  ON "locations" ("name") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "locations_iso_alpha3_active_unique"
  ON "locations" ("iso_alpha3") WHERE "deleted_at" IS NULL;

CREATE INDEX "locations_default_marketing_region_id_idx"
  ON "locations" ("default_marketing_region_id");
