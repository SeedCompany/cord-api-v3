import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const fieldZones = pgTable('field_zones', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  director_id: text('director_id'),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const fieldRegions = pgTable('field_regions', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  director_id: text('director_id'),
  field_zone_id: text('field_zone_id')
    .notNull()
    .references(() => fieldZones.id),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const fieldZonesRelations = relations(fieldZones, ({ many }) => ({
  regions: many(fieldRegions),
}));

export const fieldRegionsRelations = relations(fieldRegions, ({ one }) => ({
  zone: one(fieldZones, {
    fields: [fieldRegions.field_zone_id],
    references: [fieldZones.id],
  }),
}));
