import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { type ID, type Role } from '~/common';
import { type LocationType } from '../../../components/location/dto/location-type.enum';
import { type OrganizationReach } from '../../../components/organization/dto/organization-reach.dto';
import { type OrganizationType } from '../../../components/organization/dto/organization-type.dto';
import { type ToolKey } from '../../../components/tools/tool/dto/tool-key.enum';
import { type Gender } from '../../../components/user/dto/gender.enum';

export const userStatusEnum = pgEnum('user_status', ['Active', 'Disabled']);
export const genderEnum = pgEnum('gender', ['Male', 'Female']);
export const degreeEnum = pgEnum('degree', [
  'Primary',
  'Secondary',
  'Associates',
  'Bachelors',
  'Masters',
  'Doctorate',
]);

// Tables are added here as each domain is migrated to PostgreSQL.

// ─── Users ─────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').$type<ID<'User'>>().primaryKey(),
  isRoot: boolean('is_root').notNull().default(false),
  status: userStatusEnum('status').notNull(),
  email: text('email').unique(),
  realFirstName: text('real_first_name').notNull().default(''),
  realLastName: text('real_last_name').notNull().default(''),
  displayFirstName: text('display_first_name').notNull().default(''),
  displayLastName: text('display_last_name').notNull().default(''),
  phone: text('phone'),
  timezone: text('timezone').notNull().default('America/Chicago'),
  about: text('about'),
  title: text('title'),
  gender: genderEnum('gender').$type<Gender>(),
  photoId: text('photo_id').$type<ID<'File'>>(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  globalRoles: many(userGlobalRoles),
  sessions: many(authSessions),
  passwordResetTokens: many(authPasswordResetTokens),
  identity: one(authIdentities, {
    fields: [users.id],
    references: [authIdentities.userId],
  }),
  educations: many(educations),
  unavailabilities: many(unavailabilities),
}));

export const userGlobalRoles = pgTable(
  'user_global_roles',
  {
    userId: text('user_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<Role>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

export const userGlobalRolesRelations = relations(
  userGlobalRoles,
  ({ one }) => ({
    user: one(users, {
      fields: [userGlobalRoles.userId],
      references: [users.id],
    }),
  }),
);

// ─── Educations ────────────────────────────────────────────────────────────

export const educations = pgTable(
  'educations',
  {
    id: text('id').$type<ID<'Education'>>().primaryKey(),
    userId: text('user_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    degree: degreeEnum('degree').notNull(),
    major: text('major').notNull(),
    institution: text('institution').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('educations_user_id_idx').on(t.userId)],
);

export const educationsRelations = relations(educations, ({ one }) => ({
  user: one(users, {
    fields: [educations.userId],
    references: [users.id],
  }),
}));

// ─── Unavailabilities ──────────────────────────────────────────────────────

export const unavailabilities = pgTable(
  'unavailabilities',
  {
    id: text('id').$type<ID<'Unavailability'>>().primaryKey(),
    userId: text('user_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    start: timestamp('start', { withTimezone: true }).notNull(),
    end: timestamp('end', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('unavailabilities_valid_range_chk', sql`${t.end} > ${t.start}`),
    index('unavailabilities_user_id_idx').on(t.userId),
  ],
);

export const unavailabilitiesRelations = relations(
  unavailabilities,
  ({ one }) => ({
    user: one(users, {
      fields: [unavailabilities.userId],
      references: [users.id],
    }),
  }),
);

// ─── System Agents ─────────────────────────────────────────────────────────

export const systemAgents = pgTable('system_agents', {
  id: text('id').$type<ID<'SystemAgent'>>().primaryKey(),
  name: text('name').notNull().unique(),
  roles: text('roles').array().$type<Role[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authSessions = pgTable(
  'auth_sessions',
  {
    token: text('token').primaryKey(),
    // Null = anonymous session. Set on login, cleared on logout (soft delete via active flag).
    userId: text('user_id')
      .$type<ID<'User'>>()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Set when connectSessionToUser runs (i.e. actual login time, not token creation time).
    loggedInAt: timestamp('logged_in_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
  },
  (t) => [index('auth_sessions_user_id_idx').on(t.userId)],
);

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, {
    fields: [authSessions.userId],
    references: [users.id],
  }),
}));

// One row per user; updated in place on password change.
export const authIdentities = pgTable('auth_identities', {
  userId: text('user_id')
    .$type<ID<'User'>>()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const authIdentitiesRelations = relations(authIdentities, ({ one }) => ({
  user: one(users, {
    fields: [authIdentities.userId],
    references: [users.id],
  }),
}));

// Tokens for password resets. Deleted after use.
export const authPasswordResetTokens = pgTable(
  'auth_password_reset_tokens',
  {
    token: text('token').primaryKey(),
    userId: text('user_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    createdOn: timestamp('created_on', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('auth_password_reset_tokens_user_id_idx').on(t.userId)],
);

export const authPasswordResetTokensRelations = relations(
  authPasswordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [authPasswordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

// ─── Locations ─────────────────────────────────────────────────────────────

export const locationTypeEnum = pgEnum('location_type', [
  'Country',
  'City',
  'County',
  'Region',
  'State',
  'CrossBorderArea',
]);

export const locations = pgTable(
  'locations',
  {
    id: text('id').$type<ID<'Location'>>().primaryKey(),
    name: text('name').notNull(),
    type: locationTypeEnum('type').$type<LocationType>().notNull(),
    isoAlpha3: text('iso_alpha3'),
    fundingAccountId: text('funding_account_id')
      .$type<ID<'FundingAccount'>>()
      .references((): AnyPgColumn => fundingAccounts.id),
    defaultFieldRegionId: text('default_field_region_id')
      .$type<ID<'FieldRegion'>>()
      .references((): AnyPgColumn => fieldRegions.id),
    defaultMarketingRegionId: text('default_marketing_region_id')
      .$type<ID<'Location'>>()
      .references((): AnyPgColumn => locations.id),
    mapImageId: text('map_image_id').$type<ID<'File'>>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Partial unique indexes scoped to live rows so soft-deleted records
    // don't block reuse of their name / iso_alpha3.
    uniqueIndex('locations_name_active_unique')
      .on(t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    uniqueIndex('locations_iso_alpha3_active_unique')
      .on(t.isoAlpha3)
      .where(sql`${t.deletedAt} IS NULL`),
    index('locations_default_marketing_region_id_idx').on(
      t.defaultMarketingRegionId,
    ),
  ],
);

export const locationsRelations = relations(locations, () => ({}));

// ─── Organizations ─────────────────────────────────────────────────────────

export const organizationTypeEnum = pgEnum('organization_type', [
  'Church',
  'Parachurch',
  'Mission',
  'Translation',
  'Alliance',
]);

export const organizationReachEnum = pgEnum('organization_reach', [
  'Local',
  'Regional',
  'National',
  'Global',
]);

export const sensitivityEnum = pgEnum('sensitivity', ['Low', 'Medium', 'High']);

export const organizations = pgTable(
  'organizations',
  {
    id: text('id').$type<ID<'Organization'>>().primaryKey(),
    name: text('name').notNull(),
    acronym: text('acronym'),
    address: text('address'),
    types: organizationTypeEnum('types')
      .array()
      .$type<readonly OrganizationType[]>()
      .notNull()
      .default([]),
    reach: organizationReachEnum('reach')
      .array()
      .$type<readonly OrganizationReach[]>()
      .notNull()
      .default([]),
    // migration-todo: keep current via hooks once Project/Partnership migrate;
    // currently always 'High' since no project linkage exists in PG yet.
    sensitivity: sensitivityEnum('sensitivity').notNull().default('High'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Partial unique index scoped to live rows so soft-deleted records
    // don't block reuse of their name.
    uniqueIndex('organizations_name_active_unique')
      .on(t.name)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const organizationLocations = pgTable(
  'organization_locations',
  {
    organizationId: text('organization_id')
      .$type<ID<'Organization'>>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    locationId: text('location_id')
      .$type<ID<'Location'>>()
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.locationId] }),
    index('organization_locations_location_id_idx').on(t.locationId),
  ],
);

export const userOrganizations = pgTable(
  'user_organizations',
  {
    userId: text('user_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .$type<ID<'Organization'>>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    primary: boolean('primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.organizationId] }),
    index('user_organizations_organization_id_idx').on(t.organizationId),
    uniqueIndex('user_organizations_one_primary_per_user')
      .on(t.userId)
      .where(sql`${t.primary} = true`),
  ],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  locations: many(organizationLocations),
  users: many(userOrganizations),
}));

export const organizationLocationsRelations = relations(
  organizationLocations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationLocations.organizationId],
      references: [organizations.id],
    }),
    location: one(locations, {
      fields: [organizationLocations.locationId],
      references: [locations.id],
    }),
  }),
);

export const userOrganizationsRelations = relations(
  userOrganizations,
  ({ one }) => ({
    user: one(users, {
      fields: [userOrganizations.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [userOrganizations.organizationId],
      references: [organizations.id],
    }),
  }),
);

// ─── Field Zones / Regions ─────────────────────────────────────────────────

export const fieldZones = pgTable(
  'field_zones',
  {
    id: text('id').$type<ID<'FieldZone'>>().primaryKey(),
    name: text('name').notNull(),
    directorId: text('director_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Partial unique index scoped to live rows so soft-deleted records
    // don't block reuse of their name.
    uniqueIndex('field_zones_name_active_unique')
      .on(t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    index('field_zones_director_id_idx').on(t.directorId),
  ],
);

export const fieldZonesRelations = relations(fieldZones, ({ one, many }) => ({
  director: one(users, {
    fields: [fieldZones.directorId],
    references: [users.id],
  }),
  regions: many(fieldRegions),
}));

export const fieldRegions = pgTable(
  'field_regions',
  {
    id: text('id').$type<ID<'FieldRegion'>>().primaryKey(),
    name: text('name').notNull(),
    fieldZoneId: text('field_zone_id')
      .$type<ID<'FieldZone'>>()
      .notNull()
      .references(() => fieldZones.id),
    directorId: text('director_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Partial unique index scoped to live rows so soft-deleted records
    // don't block reuse of their name.
    uniqueIndex('field_regions_name_active_unique')
      .on(t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    index('field_regions_field_zone_id_idx').on(t.fieldZoneId),
    index('field_regions_director_id_idx').on(t.directorId),
  ],
);

export const fieldRegionsRelations = relations(fieldRegions, ({ one }) => ({
  fieldZone: one(fieldZones, {
    fields: [fieldRegions.fieldZoneId],
    references: [fieldZones.id],
  }),
  director: one(users, {
    fields: [fieldRegions.directorId],
    references: [users.id],
  }),
}));

// ─── Funding Accounts ──────────────────────────────────────────────────────

export const fundingAccounts = pgTable(
  'funding_accounts',
  {
    id: text('id').$type<ID<'FundingAccount'>>().primaryKey(),
    name: text('name').notNull(),
    accountNumber: integer('account_number').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Partial unique index scoped to live rows so soft-deleted records
    // don't block reuse of their name.
    uniqueIndex('funding_accounts_name_active_unique')
      .on(t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    check(
      'funding_accounts_account_number_range_chk',
      sql`${t.accountNumber} >= 0 AND ${t.accountNumber} <= 9`,
    ),
  ],
);

export const fundingAccountsRelations = relations(fundingAccounts, () => ({}));

// ─── Ethnologue Languages ──────────────────────────────────────────────────

export const ethnologueLanguages = pgTable(
  'ethnologue_languages',
  {
    id: text('id').$type<ID<'EthnologueLanguage'>>().primaryKey(),
    // migration-todo: add REFERENCES languages(id) ON DELETE SET NULL when
    // Language migrates in Phase 3&4. Deliberately NOT `ON DELETE CASCADE`
    // and `language_id` is nullable — preserves the path to the planned
    // future model where EthnologueLanguage is a global pool of canonical
    // language records and `language_id` is a *soft attachment* (a new
    // Language hooks into an existing pool entry by code, rather than
    // creating its own Ethnologue). Deleting a Language should release the
    // attachment, not destroy the pool entry. The Apollo client already
    // treats EthnologueLanguage as a value object (`typePolicies.base.ts:43`
    // — `keyFields: false`), and no codepath calls a delete on it.
    //
    // The `code` / `provisional_code` partial uniques stay GLOBAL (not
    // scoped to attached rows) because the future global-pool model
    // requires codes to be unique across the entire pool — orphaned and
    // attached alike. Today that means deleting a Language and then
    // creating a new one with the same code throws on the unique index;
    // that error path is the seed of the future "attach existing pool
    // entry by code" logic.
    //
    // Separate-ticket cleanup (out of scope here): `EthnologueLanguage.canDelete`
    // (on the DTO) and the `r.EthnologueLanguage.create.read.edit.delete`
    // grant in `field-services.policy.ts` are vestigial — `canDelete`
    // surfaces only because `secure()` injects it as standard Resource
    // boilerplate, and the `.delete` policy bit is never exercised. Prune
    // both in a follow-up PR.
    languageId: text('language_id').$type<ID<'Language'>>(),
    code: text('code'),
    provisionalCode: text('provisional_code'),
    name: text('name'),
    population: integer('population'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'ethnologue_languages_code_format_chk',
      sql`${t.code} IS NULL OR ${t.code} ~ '^[a-z]{3}$'`,
    ),
    check(
      'ethnologue_languages_provisional_code_format_chk',
      sql`${t.provisionalCode} IS NULL OR ${t.provisionalCode} ~ '^[a-z]{3}$'`,
    ),
    check(
      'ethnologue_languages_population_non_negative_chk',
      sql`${t.population} IS NULL OR ${t.population} >= 0`,
    ),
    uniqueIndex('ethnologue_languages_language_id_unique')
      .on(t.languageId)
      .where(sql`${t.deletedAt} IS NULL`),
    uniqueIndex('ethnologue_languages_code_unique')
      .on(t.code)
      .where(sql`${t.code} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    uniqueIndex('ethnologue_languages_provisional_code_unique')
      .on(t.provisionalCode)
      .where(sql`${t.provisionalCode} IS NOT NULL AND ${t.deletedAt} IS NULL`),
  ],
);

export const ethnologueLanguagesRelations = relations(
  ethnologueLanguages,
  () => ({}),
);

// ─── Tools ─────────────────────────────────────────────────────────────────

export const toolKeyEnum = pgEnum('tool_key', ['Rev79']);

export const tools = pgTable(
  'tools',
  {
    id: text('id').$type<ID<'Tool'>>().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    aiBased: boolean('ai_based').notNull().default(false),
    key: toolKeyEnum('key').$type<ToolKey>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Partial unique index scoped to live rows so soft-deleted records
    // don't block reuse of their name.
    uniqueIndex('tools_name_active_unique')
      .on(t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    // Partial unique on `key`: enforce one tool per machine identifier among
    // active (non-deleted) rows. NULLs are excluded by the WHERE clause so
    // tools without a key never collide.
    uniqueIndex('tools_key_unique')
      .on(t.key)
      .where(sql`${t.key} IS NOT NULL AND ${t.deletedAt} IS NULL`),
  ],
);

export const toolsRelations = relations(tools, () => ({}));
