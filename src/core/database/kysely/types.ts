import type { ColumnType, Generated, Selectable } from 'kysely';

// created_at: DB-defaulted, never written by the app.
export type CreatedTimestamp = ColumnType<Date, never, never>;
// updated_at: DB-defaulted on insert, app writes on every mutation.
export type UpdatedTimestamp = ColumnType<Date, never, Date>;
// Keep the old alias for compatibility.
export type DefaultTimestamp = CreatedTimestamp;

// Central Kysely type registry. Add one interface per table as each domain migrates.
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Database {
  field_zones: FieldZoneTable;
  field_regions: FieldRegionTable;
}

export interface FieldZoneTable {
  id: Generated<string>;
  name: string;
  director_id: string | null; // FK → users.id
  deleted_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface FieldRegionTable {
  id: Generated<string>;
  name: string;
  field_zone_id: string; // FK → field_zones.id, NOT NULL
  director_id: string | null; // FK → users.id
  deleted_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export type FieldZoneRow = Selectable<FieldZoneTable>;
export type FieldRegionRow = Selectable<FieldRegionTable>;

// Shapes returned when selecting the scalar field constants (excludes deleted_at).
export type FieldZoneSelectedRow = Pick<
  FieldZoneRow,
  'id' | 'name' | 'director_id' | 'created_at' | 'updated_at'
>;
export type FieldRegionSelectedRow = Pick<
  FieldRegionRow,
  'id' | 'name' | 'director_id' | 'field_zone_id' | 'created_at' | 'updated_at'
>;
