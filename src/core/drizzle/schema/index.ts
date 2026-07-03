import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { type ID, type Role } from '~/common';
import { type BudgetStatus } from '../../../components/budget/dto/budget-status.enum';
import { type FileNodeType } from '../../../components/file/dto/file-node-type.enum';
import { type LocationType } from '../../../components/location/dto/location-type.enum';
import { type OrganizationReach } from '../../../components/organization/dto/organization-reach.dto';
import { type OrganizationType } from '../../../components/organization/dto/organization-type.dto';
import { type PartnerType } from '../../../components/partner/dto/partner-type.enum';
import { type FinancialReportingType } from '../../../components/partnership/dto/financial-reporting-type.enum';
import { type PartnershipAgreementStatus } from '../../../components/partnership/dto/partnership-agreement-status.enum';
import { type ReportPeriod } from '../../../components/periodic-report/dto/report-period.enum';
import { type ProjectStatus } from '../../../components/project/dto/project-status.enum';
import { type ProjectStep } from '../../../components/project/dto/project-step.enum';
import { type ProjectType } from '../../../components/project/dto/project-type.enum';
import { type ToolKey } from '../../../components/tools/tool/dto/tool-key.enum';
import { type Gender } from '../../../components/user/dto/gender.enum';
import { int4multirange } from '../int4-multirange';

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
    // Null = anonymous session. Set on login (connectSessionToUser), cleared
    // on logout (disconnectUserFromSession) — logout re-anonymizes the session
    // and keeps the token active.
    userId: text('user_id')
      .$type<ID<'User'>>()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Set when connectSessionToUser runs (i.e. actual login time, not token creation time).
    loggedInAt: timestamp('logged_in_at', { withTimezone: true }),
    // Revoke flag (NOT logout). Flipped to false only by the deactivate*Sessions
    // methods (force-logout other devices, password change). Reads filter active=true.
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
    // FK indexes backfilled in 0013 — these columns predate the
    // index-every-FK standard (flagged by postgres-schema.e2e's invariant).
    index('locations_default_field_region_id_idx').on(t.defaultFieldRegionId),
    index('locations_funding_account_id_idx').on(t.fundingAccountId),
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
    // Deterministic from accountNumber (see blockOfAccount in the funding
    // account repos); SetDepartmentId resolves project → primary location →
    // funding account → block through this FK. Added in 0013.
    departmentIdBlockId: text('department_id_block_id')
      .$type<ID>()
      .references((): AnyPgColumn => departmentIdBlocks.id),
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
    index('funding_accounts_department_id_block_id_idx').on(
      t.departmentIdBlockId,
    ),
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

// ─── Files ───────────────────────────────────────────────────────────────────

export const fileNodeTypeEnum = pgEnum('file_node_type', [
  'Directory',
  'File',
  'FileVersion',
]);

export const mediaTypeEnum = pgEnum('media_type', ['Image', 'Video', 'Audio']);

export const fileNodes = pgTable(
  'file_nodes',
  {
    id: text('id').$type<ID>().primaryKey(),
    type: fileNodeTypeEnum('type').$type<FileNodeType>().notNull(),
    name: text('name').notNull(),
    // Tri-state: null = inherit from parent.
    public: boolean('public'),
    parentId: text('parent_id')
      .$type<ID>()
      .references((): AnyPgColumn => fileNodes.id),
    createdById: text('created_by_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id),
    // FileVersion only.
    mimeType: text('mime_type'),
    size: bigint('size', { mode: 'number' }),
    // File only — denormalized pointer to the latest FileVersion.
    latestVersionId: text('latest_version_id')
      .$type<ID>()
      .references((): AnyPgColumn => fileNodes.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('file_nodes_parent_id_idx').on(t.parentId),
    index('file_nodes_created_by_id_idx').on(t.createdById),
    index('file_nodes_latest_version_id_idx').on(t.latestVersionId),
    check(
      'file_nodes_shape',
      sql`(${t.type} = 'Directory' AND ${t.mimeType} IS NULL AND ${t.size} IS NULL AND ${t.latestVersionId} IS NULL)
        OR (${t.type} = 'File' AND ${t.mimeType} IS NULL AND ${t.size} IS NULL)
        OR (${t.type} = 'FileVersion' AND ${t.mimeType} IS NOT NULL AND ${t.size} IS NOT NULL AND ${t.latestVersionId} IS NULL)`,
    ),
  ],
);

export const media = pgTable(
  'media',
  {
    id: text('id').$type<ID>().primaryKey(),
    type: mediaTypeEnum('type').$type<'Image' | 'Video' | 'Audio'>().notNull(),
    fileVersionId: text('file_version_id')
      .$type<ID>()
      .notNull()
      .references(() => fileNodes.id, { onDelete: 'cascade' }),
    mimeType: text('mime_type').notNull(),
    altText: text('alt_text'),
    caption: text('caption'),
    width: integer('width'),
    height: integer('height'),
    duration: doublePrecision('duration'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('media_file_version_id_unique').on(t.fileVersionId)],
);

export const fileNodesRelations = relations(fileNodes, ({ one }) => ({
  createdBy: one(users, {
    fields: [fileNodes.createdById],
    references: [users.id],
  }),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  fileVersion: one(fileNodes, {
    fields: [media.fileVersionId],
    references: [fileNodes.id],
  }),
}));

// ─── Partner ─────────────────────────────────────────────────────────────────

export const projectTypeEnum = pgEnum('project_type', [
  'MomentumTranslation',
  'MultiplicationTranslation',
  'Internship',
]);

export const partnerTypeEnum = pgEnum('partner_type', [
  'Managing',
  'Funding',
  'Impact',
  'Technical',
  'Resource',
]);

export const financialReportingTypeEnum = pgEnum('financial_reporting_type', [
  'Funded',
  'FieldEngaged',
  'Hybrid',
]);

/**
 * Finance::Department::IdBlock — shared by Partner (user-supplied) and, later,
 * FundingAccount (computed from accountNumber). `range` mirrors Gel's native
 * `int4multirange`; `programs` are the project types the block applies to.
 */
export const departmentIdBlocks = pgTable('department_id_blocks', {
  id: text('id').$type<ID>().primaryKey(),
  range: int4multirange('range').notNull(),
  programs: projectTypeEnum('programs')
    .array()
    .$type<readonly ProjectType[]>()
    .notNull()
    .default([]),
});

export const partners = pgTable(
  'partners',
  {
    id: text('id').$type<ID<'Partner'>>().primaryKey(),
    organizationId: text('organization_id')
      .$type<ID<'Organization'>>()
      .notNull()
      .references(() => organizations.id),
    pointOfContactId: text('point_of_contact_id')
      .$type<ID<'User'>>()
      .references(() => users.id),
    types: partnerTypeEnum('types')
      .array()
      .$type<readonly PartnerType[]>()
      .notNull()
      .default([]),
    financialReportingTypes: financialReportingTypeEnum(
      'financial_reporting_types',
    )
      .array()
      .$type<readonly FinancialReportingType[]>()
      .notNull()
      .default([]),
    pmcEntityCode: text('pmc_entity_code'),
    globalInnovationsClient: boolean('global_innovations_client')
      .notNull()
      .default(false),
    active: boolean('active').notNull().default(false),
    address: text('address'),
    // migration-todo: deferred FK → languages(id); add REFERENCES when Language
    // migrates. Plain text until then (same pattern as locations.funding_account_id).
    languageOfWiderCommunicationId: text(
      'language_of_wider_communication_id',
    ).$type<ID<'Language'>>(),
    // migration-todo: deferred FK → languages(id); add when Language migrates.
    languageOfReportingId: text('language_of_reporting_id').$type<
      ID<'Language'>
    >(),
    startDate: date('start_date'),
    approvedPrograms: projectTypeEnum('approved_programs')
      .array()
      .$type<readonly ProjectType[]>()
      .notNull()
      .default([]),
    departmentIdBlockId: text('department_id_block_id')
      .$type<ID>()
      .references(() => departmentIdBlocks.id),
    // migration-todo: derived from the project's sensitivity; keep current via
    // hook once Project/Partnership migrate. Always 'High' until then — same as
    // organizations.sensitivity.
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
    // One live Partner per Organization (Neo4j enforces via partnerIdByOrg).
    uniqueIndex('partners_organization_active_unique')
      .on(t.organizationId)
      .where(sql`${t.deletedAt} IS NULL`),
    // Full FK index in addition to the partial unique above: that one only
    // covers deleted_at IS NULL rows, so PG can't use it for FK-maintenance
    // scans on organization parent updates/deletes (which check all rows).
    index('partners_organization_id_idx').on(t.organizationId),
    index('partners_point_of_contact_id_idx').on(t.pointOfContactId),
    index('partners_department_id_block_id_idx').on(t.departmentIdBlockId),
    // Indexes on deferred-FK columns — REFERENCES adds when Language migrates,
    // but the index goes in now so queries on these columns don't seq-scan and
    // we avoid `CREATE INDEX CONCURRENTLY` later (memory's "Index every FK").
    index('partners_language_of_wider_communication_id_idx').on(
      t.languageOfWiderCommunicationId,
    ),
    index('partners_language_of_reporting_id_idx').on(t.languageOfReportingId),
  ],
);

export const partnerFieldRegions = pgTable(
  'partner_field_regions',
  {
    partnerId: text('partner_id')
      .$type<ID<'Partner'>>()
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    fieldRegionId: text('field_region_id')
      .$type<ID<'FieldRegion'>>()
      .notNull()
      .references(() => fieldRegions.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.partnerId, t.fieldRegionId] }),
    index('partner_field_regions_field_region_id_idx').on(t.fieldRegionId),
  ],
);

export const partnerCountries = pgTable(
  'partner_countries',
  {
    partnerId: text('partner_id')
      .$type<ID<'Partner'>>()
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    locationId: text('location_id')
      .$type<ID<'Location'>>()
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.partnerId, t.locationId] }),
    index('partner_countries_location_id_idx').on(t.locationId),
  ],
);

export const partnerLanguagesOfConsulting = pgTable(
  'partner_languages_of_consulting',
  {
    partnerId: text('partner_id')
      .$type<ID<'Partner'>>()
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    // migration-todo: deferred FK → languages(id); add REFERENCES when
    // Language migrates.
    languageId: text('language_id').$type<ID<'Language'>>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.partnerId, t.languageId] }),
    // Right-side index for "find partners consulting language X" — the
    // composite PK only covers the left side (partner_id).
    index('partner_languages_of_consulting_language_id_idx').on(t.languageId),
  ],
);

export const departmentIdBlocksRelations = relations(
  departmentIdBlocks,
  () => ({}),
);

export const partnersRelations = relations(partners, ({ one, many }) => ({
  departmentIdBlock: one(departmentIdBlocks, {
    fields: [partners.departmentIdBlockId],
    references: [departmentIdBlocks.id],
  }),
  fieldRegions: many(partnerFieldRegions),
  countries: many(partnerCountries),
  languagesOfConsulting: many(partnerLanguagesOfConsulting),
}));

export const partnerFieldRegionsRelations = relations(
  partnerFieldRegions,
  ({ one }) => ({
    partner: one(partners, {
      fields: [partnerFieldRegions.partnerId],
      references: [partners.id],
    }),
  }),
);

export const partnerCountriesRelations = relations(
  partnerCountries,
  ({ one }) => ({
    partner: one(partners, {
      fields: [partnerCountries.partnerId],
      references: [partners.id],
    }),
  }),
);

export const partnerLanguagesOfConsultingRelations = relations(
  partnerLanguagesOfConsulting,
  ({ one }) => ({
    partner: one(partners, {
      fields: [partnerLanguagesOfConsulting.partnerId],
      references: [partners.id],
    }),
  }),
);

// ─── Project ───────────────────────────────────────────────────────────────

export const projectStepEnum = pgEnum('project_step', [
  'EarlyConversations',
  'PendingConceptApproval',
  'PrepForConsultantEndorsement',
  'PendingConsultantEndorsement',
  'PrepForFinancialEndorsement',
  'PendingFinancialEndorsement',
  'FinalizingProposal',
  'PendingRegionalDirectorApproval',
  'PendingZoneDirectorApproval',
  'PendingFinanceConfirmation',
  'OnHoldFinanceConfirmation',
  'DidNotDevelop',
  'Rejected',
  'Active',
  'ActiveChangedPlan',
  'DiscussingChangeToPlan',
  'PendingChangeToPlanApproval',
  'PendingChangeToPlanConfirmation',
  'DiscussingSuspension',
  'PendingSuspensionApproval',
  'Suspended',
  'DiscussingReactivation',
  'PendingReactivationApproval',
  'DiscussingTermination',
  'PendingTerminationApproval',
  'FinalizingCompletion',
  'Terminated',
  'Completed',
]);

export const projectStatusEnum = pgEnum('project_status', [
  'InDevelopment',
  'Active',
  'Terminated',
  'Completed',
  'DidNotDevelop',
]);

export const reportPeriodEnum = pgEnum('report_period', [
  'Monthly',
  'Quarterly',
]);

/**
 * First column to use `role` as a pgEnum (project_members.roles role[]).
 * `user_global_roles.role` predates this and is plain `text` — aligning it is
 * tracked as a separate cleanup PR (migration-todo on user_global_roles).
 */
export const roleEnum = pgEnum('role', [
  'Administrator',
  'BetaTester',
  'BibleTranslationLiaison',
  'Consultant',
  'ConsultantManager',
  'Controller',
  'ExperienceOperations',
  'FieldOperationsDirector',
  'FieldPartner',
  'FieldServices',
  'FinancialAnalyst',
  'Fundraising',
  'Intern',
  'LeadFinancialAnalyst',
  'Leadership',
  'Liaison',
  'Marketing',
  'Mentor',
  'MultiplicationFinanceApprover',
  'ProjectManager',
  'RegionalCommunicationsCoordinator',
  'RegionalDirector',
  'StaffMember',
  'Translator',
]);

/**
 * Project — single-table inheritance over the 3 concrete subtypes
 * (MomentumTranslation, MultiplicationTranslation, Internship). `type` is the
 * discriminator; `own_sensitivity` is meaningful only for Internship (Translation
 * rows ignore it and read the denormalized `sensitivity` column).
 *
 * `sensitivity` is denormalized: kept current via a hook that recomputes from
 * Engagement/Language. The hook is stubbed (`migration-todo:`) until Language
 * migrates — Translation projects read 'High' in DATABASE=postgres until then.
 *
 * `status` is `GENERATED ALWAYS AS (CASE step ... END) STORED` in the raw SQL
 * migration; mirrors Gel's `Project::statusFromStep(.step)`. Drizzle marks it
 * as generated so insert/update types omit it.
 */
export const projects = pgTable(
  'projects',
  {
    id: text('id').$type<ID<'Project'>>().primaryKey(),
    type: projectTypeEnum('type').$type<ProjectType>().notNull(),
    name: text('name').notNull(),
    step: projectStepEnum('step')
      .$type<ProjectStep>()
      .notNull()
      .default('EarlyConversations'),
    status: projectStatusEnum('status')
      .$type<ProjectStatus>()
      .generatedAlwaysAs(
        // Mirror of stepToStatus() in src/components/project/dto/project-status.enum.ts
        sql`CASE step
          WHEN 'EarlyConversations'              THEN 'InDevelopment'::project_status
          WHEN 'PendingConceptApproval'          THEN 'InDevelopment'::project_status
          WHEN 'PrepForConsultantEndorsement'    THEN 'InDevelopment'::project_status
          WHEN 'PendingConsultantEndorsement'    THEN 'InDevelopment'::project_status
          WHEN 'PrepForFinancialEndorsement'     THEN 'InDevelopment'::project_status
          WHEN 'PendingFinancialEndorsement'     THEN 'InDevelopment'::project_status
          WHEN 'FinalizingProposal'              THEN 'InDevelopment'::project_status
          WHEN 'PendingRegionalDirectorApproval' THEN 'InDevelopment'::project_status
          WHEN 'PendingZoneDirectorApproval'     THEN 'InDevelopment'::project_status
          WHEN 'PendingFinanceConfirmation'      THEN 'InDevelopment'::project_status
          WHEN 'OnHoldFinanceConfirmation'       THEN 'InDevelopment'::project_status
          WHEN 'DidNotDevelop'                   THEN 'DidNotDevelop'::project_status
          WHEN 'Rejected'                        THEN 'DidNotDevelop'::project_status
          WHEN 'Active'                          THEN 'Active'::project_status
          WHEN 'ActiveChangedPlan'               THEN 'Active'::project_status
          WHEN 'DiscussingChangeToPlan'          THEN 'Active'::project_status
          WHEN 'PendingChangeToPlanApproval'     THEN 'Active'::project_status
          WHEN 'PendingChangeToPlanConfirmation' THEN 'Active'::project_status
          WHEN 'DiscussingSuspension'            THEN 'Active'::project_status
          WHEN 'PendingSuspensionApproval'       THEN 'Active'::project_status
          WHEN 'Suspended'                       THEN 'Active'::project_status
          WHEN 'DiscussingReactivation'          THEN 'Active'::project_status
          WHEN 'PendingReactivationApproval'     THEN 'Active'::project_status
          WHEN 'DiscussingTermination'           THEN 'Active'::project_status
          WHEN 'PendingTerminationApproval'      THEN 'Active'::project_status
          WHEN 'FinalizingCompletion'            THEN 'Active'::project_status
          WHEN 'Terminated'                      THEN 'Terminated'::project_status
          WHEN 'Completed'                       THEN 'Completed'::project_status
        END`,
      )
      .notNull(),
    // migration-todo: denormalized — recompute hook fires when Engagement/Language
    // sensitivity changes (Tier 2 Language migration wires the hook). Translation
    // rows read 'High' until then; Internship reads own_sensitivity.
    sensitivity: sensitivityEnum('sensitivity').notNull().default('High'),
    // Writable only for Internship projects; Translation rows ignore it.
    ownSensitivity: sensitivityEnum('own_sensitivity'),
    rev79ProjectId: text('rev79_project_id'),
    departmentId: text('department_id'),
    departmentIdBlockId: text('department_id_block_id')
      .$type<ID>()
      .references(() => departmentIdBlocks.id),
    primaryLocationId: text('primary_location_id')
      .$type<ID<'Location'>>()
      .references((): AnyPgColumn => locations.id),
    marketingLocationId: text('marketing_location_id')
      .$type<ID<'Location'>>()
      .references((): AnyPgColumn => locations.id),
    marketingRegionOverrideId: text('marketing_region_override_id')
      .$type<ID<'Location'>>()
      .references((): AnyPgColumn => locations.id),
    fieldRegionId: text('field_region_id')
      .$type<ID<'FieldRegion'>>()
      .references(() => fieldRegions.id),
    owningOrganizationId: text('owning_organization_id')
      .$type<ID<'Organization'>>()
      .references(() => organizations.id),
    // Real FK → file_nodes(id). File is on develop (0008), so we wire this now
    // rather than deferring (mono left it plain text only because File migrated
    // after Project there). AttachProjectRootDirectoryHandler's PG path creates
    // the root dir + 4 subdirs and back-fills this column.
    rootDirectoryId: text('root_directory_id')
      .$type<ID<'Directory'>>()
      .references(() => fileNodes.id),
    mouStart: date('mou_start'),
    mouEnd: date('mou_end'),
    initialMouEnd: date('initial_mou_end'),
    estimatedSubmission: date('estimated_submission'),
    financialReportReceivedAt: timestamp('financial_report_received_at', {
      withTimezone: true,
    }),
    financialReportPeriod: reportPeriodEnum(
      'financial_report_period',
    ).$type<ReportPeriod>(),
    tags: text('tags').array().notNull().default([]),
    presetInventory: boolean('preset_inventory').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    modifiedAt: timestamp('modified_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Partial uniques — only enforced on live (non-soft-deleted) rows.
    uniqueIndex('projects_name_active_unique')
      .on(t.name)
      .where(sql`${t.deletedAt} IS NULL`),
    uniqueIndex('projects_department_id_active_unique')
      .on(t.departmentId)
      .where(sql`${t.departmentId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    // FK b-tree indexes — PG doesn't auto-index FKs.
    index('projects_department_id_block_id_idx').on(t.departmentIdBlockId),
    index('projects_primary_location_id_idx').on(t.primaryLocationId),
    index('projects_marketing_location_id_idx').on(t.marketingLocationId),
    index('projects_marketing_region_override_id_idx').on(
      t.marketingRegionOverrideId,
    ),
    index('projects_field_region_id_idx').on(t.fieldRegionId),
    index('projects_owning_organization_id_idx').on(t.owningOrganizationId),
    // FK b-tree index (PG doesn't auto-index FKs).
    index('projects_root_directory_id_idx').on(t.rootDirectoryId),
    // Filter-hot columns.
    index('projects_type_idx').on(t.type),
    index('projects_step_idx').on(t.step),
    index('projects_status_idx').on(t.status),
  ],
);

/**
 * ProjectMember — composite-unique on (project_id, user_id) for live rows.
 * `roles role[]` matches Gel's set semantics; GIN index supports the
 * `roles && ARRAY[...]::role[]` intersectsProp filter.
 */
export const projectMembers = pgTable(
  'project_members',
  {
    id: text('id').$type<ID<'ProjectMember'>>().primaryKey(),
    projectId: text('project_id')
      .$type<ID<'Project'>>()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roles: roleEnum('roles')
      .array()
      .$type<readonly Role[]>()
      .notNull()
      .default([]),
    inactiveAt: timestamp('inactive_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('project_members_project_user_active_unique')
      .on(t.projectId, t.userId)
      .where(sql`${t.deletedAt} IS NULL`),
    // Full FK index on project_id — the partial unique above excludes
    // soft-deleted rows, so PG can't use it for FK maintenance / ON DELETE
    // CASCADE scans over all children (incl. soft-deleted).
    index('project_members_project_id_idx').on(t.projectId),
    index('project_members_user_id_idx').on(t.userId),
    // GIN index for `roles && ARRAY[...]::role[]` (intersectsProp filter).
    index('project_members_roles_gin').using('gin', t.roles),
  ],
);

/**
 * ProjectWorkflowEvent — append-only event stream. A trigger on INSERT keeps
 * `projects.step` in sync (raw SQL migration). App code writes events, never
 * touches `projects.step` directly.
 */
export const projectWorkflowEvents = pgTable(
  'project_workflow_events',
  {
    id: text('id').$type<ID<'ProjectWorkflowEvent'>>().primaryKey(),
    projectId: text('project_id')
      .$type<ID<'Project'>>()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    who: text('who')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id),
    // Nullable for synthetic/initial events; populated for normal transitions.
    fromStep: projectStepEnum('from_step').$type<ProjectStep>(),
    toStep: projectStepEnum('to_step').$type<ProjectStep>().notNull(),
    // Nullable for dynamic transitions (e.g. BackToActive) where there's no
    // single transition key — they resolve at runtime from history.
    transitionKey: text('transition_key'),
    notes: jsonb('notes'), // RichText
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Compound index — every list query is "events for project X, newest first".
    index('project_workflow_events_project_id_at_idx').on(
      t.projectId,
      t.at.desc(),
    ),
    index('project_workflow_events_who_idx').on(t.who),
  ],
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  departmentIdBlock: one(departmentIdBlocks, {
    fields: [projects.departmentIdBlockId],
    references: [departmentIdBlocks.id],
  }),
  primaryLocation: one(locations, {
    fields: [projects.primaryLocationId],
    references: [locations.id],
    relationName: 'projectPrimaryLocation',
  }),
  marketingLocation: one(locations, {
    fields: [projects.marketingLocationId],
    references: [locations.id],
    relationName: 'projectMarketingLocation',
  }),
  marketingRegionOverride: one(locations, {
    fields: [projects.marketingRegionOverrideId],
    references: [locations.id],
    relationName: 'projectMarketingRegionOverride',
  }),
  fieldRegion: one(fieldRegions, {
    fields: [projects.fieldRegionId],
    references: [fieldRegions.id],
  }),
  owningOrganization: one(organizations, {
    fields: [projects.owningOrganizationId],
    references: [organizations.id],
  }),
  rootDirectory: one(fileNodes, {
    fields: [projects.rootDirectoryId],
    references: [fileNodes.id],
  }),
  members: many(projectMembers),
  workflowEvents: many(projectWorkflowEvents),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

export const projectWorkflowEventsRelations = relations(
  projectWorkflowEvents,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectWorkflowEvents.projectId],
      references: [projects.id],
    }),
    who: one(users, {
      fields: [projectWorkflowEvents.who],
      references: [users.id],
    }),
  }),
);

// ─── Partnership ───────────────────────────────────────────────────────────

export const partnershipAgreementStatusEnum = pgEnum(
  'partnership_agreement_status',
  ['NotAttached', 'AwaitingSignature', 'Signed'],
);

/**
 * Partnership — links a Project to a Partner with agreement state, MOU dates,
 * partner types (a subset of the partner's `approved_programs`-style types),
 * a financial reporting type, and a `primary` flag (one primary per project).
 *
 * `mou_id` / `agreement_id` are plain text, not FKs: create() inserts this row
 * before files.createDefinedFile() makes the file nodes, so a real FK would
 * fail the insert. See migration 0011 for the ordering rationale.
 *
 * PCR/Changeset is excluded from the migration — no overrides table, the
 * `mou_*_override` columns live on the row directly and the date coalesce
 * (override → parent project) happens in `toDto`.
 */
export const partnerships = pgTable(
  'partnerships',
  {
    id: text('id').$type<ID<'Partnership'>>().primaryKey(),
    projectId: text('project_id')
      .$type<ID<'Project'>>()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    partnerId: text('partner_id')
      .$type<ID<'Partner'>>()
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    agreementStatus: partnershipAgreementStatusEnum('agreement_status')
      .$type<PartnershipAgreementStatus>()
      .notNull()
      .default('NotAttached'),
    mouStatus: partnershipAgreementStatusEnum('mou_status')
      .$type<PartnershipAgreementStatus>()
      .notNull()
      .default('NotAttached'),
    // migration-todo: plain text (not FK) because create() inserts this row
    // before files.createDefinedFile() makes the file nodes. Add REFERENCES
    // file_nodes(id) only if create() is reordered to write the files first.
    mouId: text('mou_id').$type<ID<'File'>>(),
    agreementId: text('agreement_id').$type<ID<'File'>>(),
    mouStartOverride: date('mou_start_override'),
    mouEndOverride: date('mou_end_override'),
    types: partnerTypeEnum('types')
      .array()
      .$type<readonly PartnerType[]>()
      .notNull()
      .default([]),
    financialReportingType: financialReportingTypeEnum(
      'financial_reporting_type',
    ).$type<FinancialReportingType>(),
    primary: boolean('primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // One partnership per (project, partner) pair on live rows. Mirror of the
    // Neo4j repo's `verifyRelationshipEligibility` duplicate check; backstops
    // it at the DB level.
    uniqueIndex('partnerships_project_partner_active_unique')
      .on(t.projectId, t.partnerId)
      .where(sql`${t.deletedAt} IS NULL`),
    // At most one primary partnership per project on live rows. Drives
    // `removePrimaryFromOtherPartnerships` invariant.
    uniqueIndex('partnerships_project_primary_active_unique')
      .on(t.projectId)
      .where(sql`${t.primary} = true AND ${t.deletedAt} IS NULL`),
    // Full FK index — the partial uniques above lead with project_id but
    // can't serve FK-maintenance scans (cascades consider soft-deleted rows).
    // Backfilled in 0013; same gap class as project_members_project_id_idx.
    index('partnerships_project_id_idx').on(t.projectId),
    index('partnerships_partner_id_idx').on(t.partnerId),
    // Deferred-FK columns indexed now to avoid CREATE INDEX CONCURRENTLY when
    // a REFERENCES clause is later added.
    index('partnerships_mou_id_idx').on(t.mouId),
    index('partnerships_agreement_id_idx').on(t.agreementId),
  ],
);

export const partnershipsRelations = relations(partnerships, ({ one }) => ({
  project: one(projects, {
    fields: [partnerships.projectId],
    references: [projects.id],
  }),
  partner: one(partners, {
    fields: [partnerships.partnerId],
    references: [partners.id],
  }),
}));

// ─── Notifications ─────────────────────────────────────────────────────────

export const notificationTypeEnum = pgEnum('notification_type', [
  'System',
  'CommentViaMention',
]);

/**
 * Single-table inheritance over notification subtypes. The discriminator
 * (`type`) ⟷ the strategy registered for that DTO (its name minus the
 * `Notification` suffix), and each subtype's extra fields live in nullable
 * columns guarded by the `notifications_shape` CHECK. Per-recipient read
 * state lives in `notification_recipients`, so `unread` is computed against
 * the requesting user, not stored on the notification.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: text('id').$type<ID<'Notification'>>().primaryKey(),
    type: notificationTypeEnum('type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    creatorId: text('creator_id')
      .$type<ID<'User'>>()
      .references(() => users.id, { onDelete: 'set null' }),
    // System
    message: text('message'),
    // CommentViaMention. FK-less for now — the comments table lands in a later
    // Phase 6 migration.
    // migration-todo: add `.references(() => comments.id, { onDelete: 'cascade' })`
    // once the comments table exists (Comments domain port).
    commentId: text('comment_id').$type<ID<'Comment'>>(),
  },
  (t) => [
    index('notifications_created_at_idx').on(t.createdAt),
    // FK + deferred-FK indexes (mono added these later in 0028; recut
    // includes them up front per the index-every-FK standard).
    index('notifications_creator_id_idx').on(t.creatorId),
    index('notifications_comment_id_idx').on(t.commentId),
    check(
      'notifications_shape',
      sql`(${t.type} = 'System' AND ${t.message} IS NOT NULL AND ${t.commentId} IS NULL)
        OR (${t.type} = 'CommentViaMention' AND ${t.commentId} IS NOT NULL AND ${t.message} IS NULL)`,
    ),
  ],
);

export const notificationRecipients = pgTable(
  'notification_recipients',
  {
    notificationId: text('notification_id')
      .$type<ID<'Notification'>>()
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.notificationId, t.userId] }),
    index('notification_recipients_user_id_idx').on(t.userId),
  ],
);

// ─── Budgets ───────────────────────────────────────────────────────────────

export const budgetStatusEnum = pgEnum('budget_status', [
  'Pending',
  'Current',
  'Superceded',
  'Rejected',
]);

export const budgets = pgTable(
  'budgets',
  {
    id: text('id').$type<ID<'Budget'>>().primaryKey(),
    projectId: text('project_id')
      .$type<ID<'Project'>>()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    status: budgetStatusEnum('status')
      .$type<BudgetStatus>()
      .notNull()
      .default('Pending'),
    // Deferred FK → files(id): kept plain text (not REFERENCES) because
    // create() inserts this row BEFORE the service's createDefinedFile makes
    // the file node — same ordering as partnerships.mou_id/agreement_id.
    universalTemplateFileId: text('universal_template_file_id').$type<
      ID<'File'>
    >(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('budgets_project_id_idx').on(t.projectId)],
);

export const budgetsRelations = relations(budgets, ({ one, many }) => ({
  project: one(projects, {
    fields: [budgets.projectId],
    references: [projects.id],
  }),
  records: many(budgetRecords),
}));

export const budgetRecords = pgTable(
  'budget_records',
  {
    id: text('id').$type<ID<'BudgetRecord'>>().primaryKey(),
    budgetId: text('budget_id')
      .$type<ID<'Budget'>>()
      .notNull()
      .references(() => budgets.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .$type<ID<'Organization'>>()
      .notNull()
      .references(() => organizations.id),
    fiscalYear: integer('fiscal_year').notNull(),
    amount: doublePrecision('amount'),
    initialAmount: doublePrecision('initial_amount'),
    preApprovedAmount: doublePrecision('pre_approved_amount'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // One record per (budget, partner org, fiscal year) among live rows —
    // DB backstop for the service's verifyRecordUniqueness check.
    uniqueIndex('budget_records_budget_org_fy_active_unique')
      .on(t.budgetId, t.organizationId, t.fiscalYear)
      .where(sql`${t.deletedAt} IS NULL`),
    index('budget_records_organization_id_idx').on(t.organizationId),
  ],
);

export const budgetRecordsRelations = relations(budgetRecords, ({ one }) => ({
  budget: one(budgets, {
    fields: [budgetRecords.budgetId],
    references: [budgets.id],
  }),
  organization: one(organizations, {
    fields: [budgetRecords.organizationId],
    references: [organizations.id],
  }),
}));
