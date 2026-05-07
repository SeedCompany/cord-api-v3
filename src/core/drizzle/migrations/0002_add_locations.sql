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
  name                        text NOT NULL UNIQUE,
  type                        location_type NOT NULL,
  iso_alpha3                  text UNIQUE,
  funding_account_id          text,
  default_field_region_id     text,
  default_marketing_region_id text REFERENCES locations(id),
  map_image_id                text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz
);

CREATE INDEX "locations_default_marketing_region_id_idx"
  ON "locations" ("default_marketing_region_id");
