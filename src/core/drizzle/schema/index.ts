import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  bigserial,
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
import {
  type ID,
  type Range,
  type RichTextDocument,
  type Role,
} from '~/common';
import { type BudgetStatus } from '../../../components/budget/dto/budget-status.enum';
import { type CeremonyType } from '../../../components/ceremony/dto/ceremony-type.enum';
import { type InternshipPosition } from '../../../components/engagement/dto/intern-position.enum';
import { type EngagementStatus } from '../../../components/engagement/dto/status.enum';
import { type FileNodeType } from '../../../components/file/dto/file-node-type.enum';
import { type AIAssistedTranslation } from '../../../components/language/dto/ai-assisted-translation.enum';
import { type LanguageMilestone } from '../../../components/language/dto/language-milestone.enum';
import { type LocationType } from '../../../components/location/dto/location-type.enum';
import { type OrganizationReach } from '../../../components/organization/dto/organization-reach.dto';
import { type OrganizationType } from '../../../components/organization/dto/organization-type.dto';
import { type PartnerType } from '../../../components/partner/dto/partner-type.enum';
import { type FinancialReportingType } from '../../../components/partnership/dto/financial-reporting-type.enum';
import { type PartnershipAgreementStatus } from '../../../components/partnership/dto/partnership-agreement-status.enum';
import { type ReportPeriod } from '../../../components/periodic-report/dto/report-period.enum';
import { type ReportType } from '../../../components/periodic-report/dto/report-type.enum';
import { type PostType } from '../../../components/post/dto/post-type.enum';
import { type PostShareability } from '../../../components/post/dto/shareability.dto';
import { type ProductMedium } from '../../../components/product/dto/product-medium.enum';
import { type ProductMethodology } from '../../../components/product/dto/product-methodology.enum';
import { type ProductPurpose } from '../../../components/product/dto/product-purpose.enum';
import { type ProductStep } from '../../../components/product/dto/product-step.enum';
import { type ProgressMeasurement } from '../../../components/product/dto/progress-measurement.enum';
import { type ProgressReportStatus } from '../../../components/progress-report/dto/progress-report-status.enum';
import { type MediaCategory } from '../../../components/progress-report/media/media-category.enum';
import { type ProjectStatus } from '../../../components/project/dto/project-status.enum';
import { type ProjectStep } from '../../../components/project/dto/project-step.enum';
import { type ProjectType } from '../../../components/project/dto/project-type.enum';
import { type Prompt } from '../../../components/prompts/dto/prompt.dto';
import { type ToolKey } from '../../../components/tools/tool/dto/tool-key.enum';
import { type Gender } from '../../../components/user/dto/gender.enum';
import { type LanguageProficiency } from '../../../components/user/dto/language-proficiency.enum';
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
    // Partial unique index scoped to live rows so soft-deleted records don't
    // block reuse of their name. `iso_alpha3` is deliberately NOT unique —
    // Neo4j never constrained it, and nothing *filters* on it (the resolver reads
    // the value and resolves the ISO country in app code). It IS a selectable
    // sort key though, so it is not unread; there is simply no index behind that
    // sort, which this table's size makes fine. See migration 0030.
    uniqueIndex('locations_name_active_unique')
      .on(t.name)
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
    // funding account → block through this FK. Added in 0014.
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
    // The reference to `languages(id)` ALREADY EXISTS — added by migration 0016
    // and fully enforced. (An earlier version of this comment still asked for it
    // to be added "when Language migrates"; Language migrated, and the FK came
    // with it.)
    //
    // migration-todo: only the `ON DELETE SET NULL` half is outstanding.
    // Deliberately NOT `ON DELETE CASCADE`, and `language_id` stays nullable —
    // that preserves the path to the planned future model where
    // EthnologueLanguage is a global pool of canonical language records and
    // `language_id` is a *soft attachment* (a new Language hooks into an existing
    // pool entry by code rather than creating its own Ethnologue). Deleting a
    // Language should release the attachment, not destroy the pool entry. The
    // Apollo client already treats EthnologueLanguage as a value object
    // (`typePolicies.base.ts:43` — `keyFields: false`), and no codepath calls a
    // delete on it.
    //
    // Codes are NOT unique — see migration 0030 and the note further down this
    // table. An earlier version of this comment said the `code` /
    // `provisional_code` uniques stayed GLOBAL to support that pool model, and
    // that recreating a Language with an existing code would throw on the unique
    // index. Neither is true any more: ethnologue codes are shared across a large
    // share of languages, so a pool keyed uniquely by code cannot exist, and 0030
    // drops both indexes along with the handlers that translated their
    // violations. So when the pool model is built, "attach to the existing entry
    // by code" has to disambiguate MULTIPLE candidates per code in application
    // code — a single-row lookup by code is not something the database can
    // guarantee.
    //
    // Separate-ticket cleanup (out of scope here): `EthnologueLanguage.canDelete`
    // (on the DTO) and the `r.EthnologueLanguage.create.read.edit.delete`
    // grant in `field-services.policy.ts` are vestigial — `canDelete`
    // surfaces only because `secure()` injects it as standard Resource
    // boilerplate, and the `.delete` policy bit is never exercised. Prune
    // both in a follow-up PR.
    languageId: text('language_id')
      .$type<ID<'Language'>>()
      .references((): AnyPgColumn => languages.id),
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
    // Full FK index — the partial unique above can't serve FK-maintenance
    // scans. Added in 0016 alongside the REFERENCES attach.
    index('ethnologue_languages_language_id_idx').on(t.languageId),
    // `code` and `provisional_code` are deliberately NOT unique. Languages share
    // ethnologue codes routinely, and Neo4j never constrained either column. The
    // unique key for a language is its ROLV code, over on `languages`. See
    // migration 0030.
  ],
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
    // Exactly one of `who` / `who_system_agent_id` is set — a transition always
    // has an actor, but it is a User or a SystemAgent. Most events are
    // agent-driven, and Neo4j has always matched `node('who','Actor')`.
    // See migration 0031, and `resource_mutations` for the same arc on the audit
    // log (which stores the agent's name, not an FK — the reasoning for the
    // difference is in 0031's header).
    who: text('who')
      .$type<ID<'User'>>()
      .references(() => users.id),
    whoSystemAgentId: text('who_system_agent_id')
      .$type<ID<'SystemAgent'>>()
      .references(() => systemAgents.id),
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
    index('project_workflow_events_who_system_agent_id_idx').on(
      t.whoSystemAgentId,
    ),
    check(
      'project_workflow_events_actor_shape_chk',
      sql`num_nonnulls(${t.who}, ${t.whoSystemAgentId}) = 1`,
    ),
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
    // Phase 6 migration. FK to comments added with the Comments migration
    // (0024) — a deferred (thunked) reference since `comments` is declared
    // later in this file.
    commentId: text('comment_id')
      .$type<ID<'Comment'>>()
      .references(() => comments.id, { onDelete: 'cascade' }),
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
  (t) => [
    index('budgets_project_id_idx').on(t.projectId),
    // Indexed up front so the File domain can add the REFERENCES clause
    // without a CREATE INDEX CONCURRENTLY backfill — same convention as
    // partnerships.mou_id/agreement_id.
    index('budgets_universal_template_file_id_idx').on(
      t.universalTemplateFileId,
    ),
  ],
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
    // Full FK index — the partial unique above leads with budget_id but can't
    // serve FK-maintenance scans (soft-deleted rows excluded).
    index('budget_records_budget_id_idx').on(t.budgetId),
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

// ─── Languages ─────────────────────────────────────────────────────────────

export const languages = pgTable(
  'languages',
  {
    id: text('id').$type<ID<'Language'>>().primaryKey(),
    name: text('name').notNull(),
    displayName: text('display_name').notNull(),
    displayNamePronunciation: text('display_name_pronunciation'),
    // User-settable. `effectiveSensitivity` is computed at read time as the
    // lowest sensitivity across projects engaging this language (mirror of
    // the Neo4j hydrate); falls back to this column when unengaged.
    sensitivity: sensitivityEnum('sensitivity').notNull().default('High'),
    isDialect: boolean('is_dialect').notNull().default(false),
    populationOverride: integer('population_override'),
    registryOfLanguageVarietiesCode: text(
      'registry_of_language_varieties_code',
    ),
    leastOfThese: boolean('least_of_these').notNull().default(false),
    leastOfTheseReason: text('least_of_these_reason'),
    isSignLanguage: boolean('is_sign_language').notNull().default(false),
    signLanguageCode: text('sign_language_code'),
    sponsorEstimatedEndDate: date('sponsor_estimated_end_date'),
    hasExternalFirstScripture: boolean('has_external_first_scripture')
      .notNull()
      .default(false),
    tags: text('tags').array().$type<readonly string[]>().notNull().default([]),
    isAvailableForReporting: boolean('is_available_for_reporting')
      .notNull()
      .default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // The ROLV code is the unique natural key for a language; the names
    // deliberately are NOT. Distinct languages legitimately share a name — real
    // data contains such groups, each separable by ROLV — and Neo4j never
    // constrained them. The comment that used to sit here claimed these mirrored
    // Neo4j `LanguageName` / `LanguageDisplayName` constraints; those constraints
    // do not exist, and the claim misled two separate pieces of work. Partial,
    // scoped to live rows. See migration 0030.
    uniqueIndex('languages_rolv_code_active_unique')
      .on(t.registryOfLanguageVarietiesCode)
      .where(
        sql`${t.registryOfLanguageVarietiesCode} IS NOT NULL AND ${t.deletedAt} IS NULL`,
      ),
  ],
);

export const languagesRelations = relations(languages, ({ one }) => ({
  // 1:1 — the FK lives on ethnologue_languages.language_id (soft attachment;
  // see that table's comment for the future global-pool model).
  ethnologue: one(ethnologueLanguages, {
    fields: [languages.id],
    references: [ethnologueLanguages.languageId],
  }),
}));

export const ethnologueLanguagesRelations = relations(
  ethnologueLanguages,
  ({ one }) => ({
    language: one(languages, {
      fields: [ethnologueLanguages.languageId],
      references: [languages.id],
    }),
  }),
);

// ─── Product vocabulary enums ──────────────────────────────────────────────
// Declared ahead of the Engagements section because engagements.methodologies
// shares product_methodology. Value sets mirror the app enums in
// src/components/product/dto (postgres-schema.e2e enforces parity) and Gel's
// Product::Medium/Purpose/Step/Methodology scalars.

export const productMediumEnum = pgEnum('product_medium', [
  'Print',
  'Web',
  'EBook',
  'App',
  'TrainedStoryTellers',
  'Audio',
  'Video',
  'Other',
]);

export const productPurposeEnum = pgEnum('product_purpose', [
  'EvangelismChurchPlanting',
  'ChurchLife',
  'ChurchMaturity',
  'SocialIssues',
  'Discipleship',
]);

export const productStepEnum = pgEnum('product_step', [
  'ExegesisAndFirstDraft',
  'TeamCheck',
  'CommunityTesting',
  'BackTranslation',
  'ConsultantCheck',
  'InternalizationAndDrafting',
  'PeerRevision',
  'ConsistencyCheckAndFinalEdits',
  'Craft',
  'Test',
  'Check',
  'Record',
  'Develop',
  'Translate',
  'Completed',
]);

export const productMethodologyEnum = pgEnum('product_methodology', [
  'Paratext',
  'OtherWritten',
  'Render',
  'Audacity',
  'AdobeAudition',
  'OtherOralTranslation',
  'StoryTogether',
  'SeedCompanyMethod',
  'OneStory',
  'Craft2Tell',
  'OtherOralStories',
  'Film',
  'SignLanguage',
  'OtherVisual',
]);

// ─── Engagements ───────────────────────────────────────────────────────────

export const engagementTypeEnum = pgEnum('engagement_type', [
  'Language',
  'Internship',
]);

export const engagementStatusEnum = pgEnum('engagement_status', [
  'InDevelopment',
  'DidNotDevelop',
  'Rejected',
  'Active',
  'ActiveChangedPlan',
  'DiscussingTermination',
  'DiscussingReactivation',
  'DiscussingChangeToPlan',
  'DiscussingSuspension',
  'Suspended',
  'FinalizingCompletion',
  'Terminated',
  'Completed',
  // Legacy — only used in historic data.
  'Converted',
  'Unapproved',
  'Transferred',
  'NotRenewed',
]);

export const languageMilestoneEnum = pgEnum('language_milestone', [
  'Unknown',
  'None',
  'OldTestament',
  'NewTestament',
  'FullBible',
]);

export const aiAssistedTranslationEnum = pgEnum('ai_assisted_translation', [
  'Unknown',
  'None',
  'Draft',
  'Check',
  'DraftAndCheck',
  'Other',
]);

/**
 * Single-table inheritance over LanguageEngagement / InternshipEngagement —
 * same approach as projects. The `type` discriminator matches the parent
 * project's type (Language ⟷ Translation projects, Internship ⟷ Internship
 * projects); the CHECK below keeps the per-type columns coherent.
 * `position` is text-typed (InternshipPosition lives in the app; convert with
 * the internship vocab if ever needed). `methodologies` uses the
 * product_methodology enum declared above with the product vocabulary.
 */
export const engagements = pgTable(
  'engagements',
  {
    id: text('id').$type<ID<'Engagement'>>().primaryKey(),
    projectId: text('project_id')
      .$type<ID<'Project'>>()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    type: engagementTypeEnum('type').notNull(),
    status: engagementStatusEnum('status')
      .$type<EngagementStatus>()
      .notNull()
      .default('InDevelopment'),
    statusModifiedAt: timestamp('status_modified_at', { withTimezone: true }),
    lastSuspendedAt: timestamp('last_suspended_at', { withTimezone: true }),
    lastReactivatedAt: timestamp('last_reactivated_at', { withTimezone: true }),
    completeDate: date('complete_date'),
    disbursementCompleteDate: date('disbursement_complete_date'),
    startDateOverride: date('start_date_override'),
    endDateOverride: date('end_date_override'),
    initialEndDate: date('initial_end_date'),
    description: jsonb('description'),

    // ── LanguageEngagement only ──
    languageId: text('language_id')
      .$type<ID<'Language'>>()
      .references(() => languages.id),
    // Nullable to mirror Neo4j semantics — unset is distinct from false and
    // surfaces as null in the API.
    firstScripture: boolean('first_scripture'),
    lukePartnership: boolean('luke_partnership'),
    openToInvestorVisit: boolean('open_to_investor_visit'),
    paratextRegistryId: text('paratext_registry_id'),
    rev79CommunityId: text('rev79_community_id'),
    // migration-todo: deferred FK → files(id); populate when File migrates
    // (Phase 7). Null until then.
    pnpId: text('pnp_id').$type<ID<'File'>>(),
    sentPrintingDate: date('sent_printing_date'),
    historicGoal: text('historic_goal'),
    milestonePlanned: languageMilestoneEnum('milestone_planned')
      .$type<LanguageMilestone>()
      .notNull()
      .default('Unknown'),
    milestoneReached: boolean('milestone_reached'),
    usingAIAssistedTranslation: aiAssistedTranslationEnum(
      'using_ai_assisted_translation',
    )
      .$type<AIAssistedTranslation>()
      .notNull()
      .default('Unknown'),

    // ── InternshipEngagement only ──
    internId: text('intern_id')
      .$type<ID<'User'>>()
      .references(() => users.id),
    mentorId: text('mentor_id')
      .$type<ID<'User'>>()
      .references(() => users.id),
    position: text('position').$type<InternshipPosition>(),
    methodologies: productMethodologyEnum('methodologies')
      .array()
      .$type<readonly ProductMethodology[]>()
      .notNull()
      .default([]),
    countryOfOriginId: text('country_of_origin_id')
      .$type<ID<'Location'>>()
      .references(() => locations.id),
    // migration-todo: deferred FK → files(id); Phase 7.
    growthPlanId: text('growth_plan_id').$type<ID<'File'>>(),
    marketable: boolean('marketable').notNull().default(false),
    webId: text('web_id'),

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
    check(
      'engagements_type_shape_chk',
      sql`(${t.type} = 'Language' AND ${t.languageId} IS NOT NULL AND ${t.internId} IS NULL)
        OR (${t.type} = 'Internship' AND ${t.internId} IS NOT NULL AND ${t.languageId} IS NULL)`,
    ),
    uniqueIndex('engagements_project_language_active_unique')
      .on(t.projectId, t.languageId)
      .where(sql`${t.languageId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    uniqueIndex('engagements_project_intern_active_unique')
      .on(t.projectId, t.internId)
      .where(sql`${t.internId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    index('engagements_project_id_idx').on(t.projectId),
    index('engagements_language_id_idx').on(t.languageId),
    index('engagements_intern_id_idx').on(t.internId),
    index('engagements_mentor_id_idx').on(t.mentorId),
    index('engagements_country_of_origin_id_idx').on(t.countryOfOriginId),
  ],
);

export const engagementsRelations = relations(engagements, ({ one, many }) => ({
  products: many(products),
  project: one(projects, {
    fields: [engagements.projectId],
    references: [projects.id],
  }),
  language: one(languages, {
    fields: [engagements.languageId],
    references: [languages.id],
  }),
  intern: one(users, {
    fields: [engagements.internId],
    references: [users.id],
  }),
  mentor: one(users, {
    fields: [engagements.mentorId],
    references: [users.id],
  }),
  countryOfOrigin: one(locations, {
    fields: [engagements.countryOfOriginId],
    references: [locations.id],
  }),
  ceremony: one(ceremonies, {
    fields: [engagements.id],
    references: [ceremonies.engagementId],
  }),
}));

/**
 * Previous statuses, newest first — drives the rules engine's "BackTo"
 * dynamic transitions (mirror of Neo4j's inactive status Property history).
 * The repo appends the OLD status whenever status changes.
 */
export const engagementStatusHistory = pgTable(
  'engagement_status_history',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    engagementId: text('engagement_id')
      .$type<ID<'Engagement'>>()
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    status: engagementStatusEnum('status').$type<EngagementStatus>().notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('engagement_status_history_engagement_id_at_idx').on(
      t.engagementId,
      t.at,
    ),
  ],
);

// ─── Ceremonies ────────────────────────────────────────────────────────────

export const ceremonyTypeEnum = pgEnum('ceremony_type', [
  'Dedication',
  'Certification',
]);

export const ceremonies = pgTable(
  'ceremonies',
  {
    id: text('id').$type<ID<'Ceremony'>>().primaryKey(),
    engagementId: text('engagement_id')
      .$type<ID<'Engagement'>>()
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    type: ceremonyTypeEnum('type').$type<CeremonyType>().notNull(),
    planned: boolean('planned').notNull().default(false),
    estimatedDate: date('estimated_date'),
    actualDate: date('actual_date'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // 1:1 with engagement among live rows (Gel: exclusive on .engagement).
    uniqueIndex('ceremonies_engagement_active_unique')
      .on(t.engagementId)
      .where(sql`${t.deletedAt} IS NULL`),
    // Full FK index — the partial unique above can't serve FK-maintenance scans.
    index('ceremonies_engagement_id_idx').on(t.engagementId),
  ],
);

export const ceremoniesRelations = relations(ceremonies, ({ one }) => ({
  engagement: one(engagements, {
    fields: [ceremonies.engagementId],
    references: [engagements.id],
  }),
}));

// ─── Producibles ───────────────────────────────────────────────────────────

export const producibleTypeEnum = pgEnum('producible_type', [
  'Film',
  'Story',
  'EthnoArt',
]);

/**
 * Film / Story / EthnoArt share one table — they are shape-identical
 * (name + scripture references); the discriminator stands in for the Neo4j
 * label. Scripture references are stored as the same `{start, end}` verse-id
 * pairs Neo4j stores on ScriptureRange nodes; they are only ever read/written
 * as a whole list, so jsonb over a child table.
 */
export const producibles = pgTable(
  'producibles',
  {
    id: text('id').$type<ID>().primaryKey(),
    type: producibleTypeEnum('type').notNull(),
    name: text('name').notNull(),
    scriptureReferences: jsonb('scripture_references')
      .$type<ReadonlyArray<Range<number>>>()
      .notNull()
      .default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Name is unique per type among live rows (matches Neo4j per-label check).
    uniqueIndex('producibles_type_name_active_unique')
      .on(t.type, t.name)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ─── Products ──────────────────────────────────────────────────────────────

export const productTypeEnum = pgEnum('product_type', [
  'DirectScripture',
  'Derivative',
  'Other',
]);

export const progressMeasurementEnum = pgEnum('progress_measurement', [
  'Number',
  'Percent',
  'Boolean',
]);

/**
 * Single-table inheritance over DirectScriptureProduct /
 * DerivativeScriptureProduct / OtherProduct (same approach as projects and
 * engagements). mediums/purposes/steps/methodology use the product vocabulary
 * pgEnums (declared above the Engagements section), mirroring Gel's scalars.
 *
 * Scripture columns mirror how the DTOs distinguish the subtypes:
 * - Direct: `scriptureReferences` (or the unspecified-portion pair for legacy
 *   data where only a verse total is known).
 * - Derivative: `scriptureReferencesOverride`; null means "not overriding"
 *   (use the producible's list) — this replaces Neo4j's `isOverriding` flag.
 */
export const products = pgTable(
  'products',
  {
    id: text('id').$type<ID<'Product'>>().primaryKey(),
    engagementId: text('engagement_id')
      .$type<ID<'Engagement'>>()
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    type: productTypeEnum('type').notNull(),
    mediums: productMediumEnum('mediums')
      .array()
      .$type<readonly ProductMedium[]>()
      .notNull()
      .default([]),
    purposes: productPurposeEnum('purposes')
      .array()
      .$type<readonly ProductPurpose[]>()
      .notNull()
      .default([]),
    methodology:
      productMethodologyEnum('methodology').$type<ProductMethodology>(),
    steps: productStepEnum('steps')
      .array()
      .$type<readonly ProductStep[]>()
      .notNull()
      .default([]),
    describeCompletion: text('describe_completion'),
    placeholderDescription: text('placeholder_description'),
    progressStepMeasurement: progressMeasurementEnum(
      'progress_step_measurement',
    )
      .$type<ProgressMeasurement>()
      .notNull()
      .default('Percent'),
    progressTarget: doublePrecision('progress_target').notNull().default(100),

    scriptureReferences: jsonb('scripture_references')
      .$type<ReadonlyArray<Range<number>>>()
      .notNull()
      .default([]),
    scriptureReferencesOverride: jsonb('scripture_references_override').$type<
      ReadonlyArray<Range<number>>
    >(),
    unspecifiedScriptureBook: text('unspecified_scripture_book'),
    unspecifiedScriptureTotalVerses: integer(
      'unspecified_scripture_total_verses',
    ),
    totalVerses: integer('total_verses').notNull().default(0),
    totalVerseEquivalents: doublePrecision('total_verse_equivalents')
      .notNull()
      .default(0),

    // ── DerivativeScriptureProduct only ──
    producesId: text('produces_id')
      .$type<ID>()
      .references(() => producibles.id),
    composite: boolean('composite'),

    // ── OtherProduct only ──
    title: text('title'),
    description: text('description'),

    pnpIndex: integer('pnp_index'),

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
      'products_type_shape_chk',
      sql`(${t.type} = 'DirectScripture' AND ${t.producesId} IS NULL AND ${t.title} IS NULL)
        OR (${t.type} = 'Derivative' AND ${t.producesId} IS NOT NULL AND ${t.title} IS NULL)
        OR (${t.type} = 'Other' AND ${t.title} IS NOT NULL AND ${t.producesId} IS NULL)`,
    ),
    check(
      'products_unspecified_scripture_chk',
      sql`(${t.unspecifiedScriptureBook} IS NULL) = (${t.unspecifiedScriptureTotalVerses} IS NULL)`,
    ),
    index('products_engagement_id_idx').on(t.engagementId),
    index('products_produces_id_idx').on(t.producesId),
  ],
);

export const productsRelations = relations(products, ({ one }) => ({
  engagement: one(engagements, {
    fields: [products.engagementId],
    references: [engagements.id],
  }),
  produces: one(producibles, {
    fields: [products.producesId],
    references: [producibles.id],
  }),
}));

/**
 * Suggestion store for `describeCompletion` — merged on every product
 * create/update that sets one (mirror of the Neo4j full-text-indexed
 * ProductCompletionDescription nodes; suggestions use ILIKE here).
 */
export const productCompletionDescriptions = pgTable(
  'product_completion_descriptions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    value: text('value').notNull(),
    methodology: productMethodologyEnum('methodology')
      .$type<ProductMethodology>()
      .notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('product_completion_descriptions_value_methodology_unique').on(
      t.value,
      t.methodology,
    ),
  ],
);

// ─── Periodic Reports ──────────────────────────────────────────────────────

export const reportTypeEnum = pgEnum('report_type', [
  'Financial',
  'Narrative',
  'Progress',
]);

export const progressReportStatusEnum = pgEnum('progress_report_status', [
  'NotStarted',
  'InProgress',
  'PendingTranslation',
  'InReview',
  'Approved',
  'Published',
]);

/**
 * Single table over FinancialReport / NarrativeReport / ProgressReport.
 * Financial+Narrative hang off projects; Progress hangs off (language)
 * engagements — the CHECK keeps the parent FK coherent with the type.
 *
 * The id is deterministic — sha256(parent:type:start:end), same derivation as
 * Neo4j — so concurrent syncs computing rows for the same interval collide on
 * the PK and resolve via ON CONFLICT DO NOTHING. Deletion is a REAL delete
 * (no deleted_at): eligible rows carry no user data (no file, NotStarted),
 * and a soft-deleted row would block the deterministic id from ever being
 * recreated when dates change back.
 *
 * `status` is ProgressReport-only (workflow-driven; plain column like
 * engagement.status).
 */
export const periodicReports = pgTable(
  'periodic_reports',
  {
    id: text('id').$type<ID>().primaryKey(),
    type: reportTypeEnum('type').$type<ReportType>().notNull(),
    projectId: text('project_id')
      .$type<ID<'Project'>>()
      .references(() => projects.id, { onDelete: 'cascade' }),
    engagementId: text('engagement_id')
      .$type<ID<'Engagement'>>()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    start: date('start').notNull(),
    end: date('end').notNull(),
    receivedDate: date('received_date'),
    skippedReason: text('skipped_reason'),
    // migration-todo(cutover-cleanup): plain text, no FK — S4 class. The
    // file_nodes table exists (0008), but the createDefinedFile fan-out
    // inserts this row before its file rows; real FKs land with the S4
    // option-2 reorder at cutover cleanup.
    reportFileId: text('report_file_id').$type<ID<'File'>>(),
    // Columns-mono-style per Rob 2026-07-16 (periodic_report_files join-table
    // redesign = post-cutover ticket). Same S4 deferred-FK class as above.
    narrativeFileId: text('narrative_file_id').$type<ID<'File'>>(),
    narrativeReceivedDate: date('narrative_received_date'),
    status: progressReportStatusEnum('status').$type<ProgressReportStatus>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      'periodic_reports_parent_shape_chk',
      sql`(${t.type} IN ('Financial', 'Narrative') AND ${t.projectId} IS NOT NULL AND ${t.engagementId} IS NULL)
        OR (${t.type} = 'Progress' AND ${t.engagementId} IS NOT NULL AND ${t.projectId} IS NULL)`,
    ),
    check(
      'periodic_reports_status_shape_chk',
      sql`(${t.type} = 'Progress') = (${t.status} IS NOT NULL)`,
    ),
    index('periodic_reports_project_id_idx').on(t.projectId),
    index('periodic_reports_engagement_id_idx').on(t.engagementId),
  ],
);

export const periodicReportsRelations = relations(
  periodicReports,
  ({ one }) => ({
    project: one(projects, {
      fields: [periodicReports.projectId],
      references: [projects.id],
    }),
    engagement: one(engagements, {
      fields: [periodicReports.engagementId],
      references: [engagements.id],
    }),
  }),
);

// ─── Prompt Variant Responses ──────────────────────────────────────────────

/**
 * Generic prompt-response container shared by every PromptVariantResponse
 * subtype (ProgressReport team news / highlights / community stories; more
 * later). `resource_type` is the concrete DTO name (stands in for the Neo4j
 * label); `parent_id` is intentionally FK-less — parents span tables
 * (periodic_reports today, others as domains migrate). Prompts are
 * code-defined; only the chosen prompt id is stored.
 */
export const promptVariantResponses = pgTable(
  'prompt_variant_responses',
  {
    id: text('id').$type<ID>().primaryKey(),
    resourceType: text('resource_type').notNull(),
    parentId: text('parent_id').$type<ID>().notNull(),
    // Holds a Prompt's id, not its text — prompts are defined in app code
    // rather than a table, which is why there's no FK to point at.
    prompt: text('prompt').$type<ID<Prompt>>().notNull(),
    creatorId: text('creator_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id),
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
    index('prompt_variant_responses_parent_id_idx').on(t.parentId),
    index('prompt_variant_responses_creator_id_idx').on(t.creatorId),
  ],
);

/**
 * One row per (response, variant) — the actual rich-text answers. Edits
 * within the permanent-after window update in place; later edits soft-delete
 * the old row and insert a new one (mirror of Neo4j's deactivate+create
 * history chain).
 */
export const promptVariantResponseEntries = pgTable(
  'prompt_variant_response_entries',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    responseId: text('response_id')
      .$type<ID>()
      .notNull()
      .references(() => promptVariantResponses.id, { onDelete: 'cascade' }),
    variant: text('variant').notNull(),
    // Always a rich-text document, so say so — untyped jsonb reads back as
    // `unknown`, which then needs a cast at every use.
    response: jsonb('response').$type<RichTextDocument | null>(),
    creatorId: text('creator_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    modifiedAt: timestamp('modified_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex(
      'prompt_variant_response_entries_response_variant_active_unique',
    )
      .on(t.responseId, t.variant)
      .where(sql`${t.deletedAt} IS NULL`),
    // Full FK index — the partial unique can't serve FK-maintenance scans.
    index('prompt_variant_response_entries_response_id_idx').on(t.responseId),
    index('prompt_variant_response_entries_creator_id_idx').on(t.creatorId),
  ],
);

export const promptVariantResponsesRelations = relations(
  promptVariantResponses,
  ({ many }) => ({
    entries: many(promptVariantResponseEntries),
  }),
);

export const promptVariantResponseEntriesRelations = relations(
  promptVariantResponseEntries,
  ({ one }) => ({
    parent: one(promptVariantResponses, {
      fields: [promptVariantResponseEntries.responseId],
      references: [promptVariantResponses.id],
    }),
  }),
);

// ─── Product Progress + Progress Summaries ─────────────────────────────────

/**
 * Progress container per (product, report, variant) — exists once any step
 * progress is reported. Step rows hang off it; unreported steps surface as
 * placeholders at read time, ordered by the product's declared steps.
 */
export const productProgress = pgTable(
  'product_progress',
  {
    id: text('id').$type<ID>().primaryKey(),
    productId: text('product_id')
      .$type<ID<'Product'>>()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    reportId: text('report_id')
      .$type<ID>()
      .notNull()
      .references(() => periodicReports.id, { onDelete: 'cascade' }),
    variant: text('variant').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('product_progress_product_report_variant_unique').on(
      t.productId,
      t.reportId,
      t.variant,
    ),
    index('product_progress_report_id_idx').on(t.reportId),
  ],
);

export const stepProgress = pgTable(
  'step_progress',
  {
    id: text('id').$type<ID>().primaryKey(),
    progressId: text('progress_id')
      .$type<ID>()
      .notNull()
      .references(() => productProgress.id, { onDelete: 'cascade' }),
    // product_step enum — matches products.steps (mono had no enum type).
    step: productStepEnum('step').$type<ProductStep>().notNull(),
    completed: doublePrecision('completed'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('step_progress_progress_step_unique').on(t.progressId, t.step),
  ],
);

export const productProgressRelations = relations(
  productProgress,
  ({ many }) => ({
    steps: many(stepProgress),
  }),
);

export const stepProgressRelations = relations(stepProgress, ({ one }) => ({
  progress: one(productProgress, {
    fields: [stepProgress.progressId],
    references: [productProgress.id],
  }),
}));

export const summaryPeriodEnum = pgEnum('summary_period', [
  'ReportPeriod',
  'FiscalYearSoFar',
  'Cumulative',
]);

/**
 * Extracted planned/actual figures per (progress report, period) — written
 * by the PnP extractor on report file upload (File domain, Phase 7); the
 * read path serves the ProgressReport summary fields.
 */
export const progressSummaries = pgTable(
  'progress_summaries',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    reportId: text('report_id')
      .$type<ID>()
      .notNull()
      .references(() => periodicReports.id, { onDelete: 'cascade' }),
    period: summaryPeriodEnum('period').notNull(),
    planned: doublePrecision('planned').notNull(),
    actual: doublePrecision('actual').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('progress_summaries_report_period_unique').on(
      t.reportId,
      t.period,
    ),
  ],
);

// ─── Pins ──────────────────────────────────────────────────────────────────

/**
 * Per-user pins over any resource. `resource_id` is FK-less because a user can
 * pin any Pinnable (Project, Language, Partner, User, …) which span tables —
 * same rationale as prompt_variant_responses.parent_id. The composite PK makes
 * pin/unpin idempotent and the per-requester `pinned` field lookup a PK hit.
 */
export const pins = pgTable(
  'pins',
  {
    userId: text('user_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    resourceId: text('resource_id').$type<ID>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.resourceId] })],
);

// ─── Known Languages ─────────────────────────────────────────────────────────

export const languageProficiencyEnum = pgEnum('language_proficiency', [
  'Beginner',
  'Conversational',
  'Skilled',
  'Fluent',
]);

/**
 * A user's known languages, at a proficiency level. A user may know a
 * language at more than one proficiency (the Neo4j create only replaces the
 * exact (user, language, proficiency) edge), so the PK spans all three and
 * create is an idempotent ON CONFLICT DO NOTHING.
 */
export const knownLanguages = pgTable(
  'known_languages',
  {
    userId: text('user_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    languageId: text('language_id')
      .$type<ID<'Language'>>()
      .notNull()
      .references(() => languages.id, { onDelete: 'cascade' }),
    proficiency: languageProficiencyEnum('proficiency')
      .$type<LanguageProficiency>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.languageId, t.proficiency] }),
    index('known_languages_user_id_idx').on(t.userId),
    index('known_languages_language_id_idx').on(t.languageId),
  ],
);

// ─── Comments ────────────────────────────────────────────────────────────────

/**
 * A comment thread attached to any Commentable resource. `parent_id` is
 * FK-less and polymorphic (User/Language/Partner/Project/Engagement/
 * ProgressReport span tables, same rationale as
 * prompt_variant_responses.parent_id); `parent_type` is the discriminator used
 * to rebuild the parent's fake BaseNode at read time.
 */
export const commentThreads = pgTable(
  'comment_threads',
  {
    id: text('id').$type<ID<'CommentThread'>>().primaryKey(),
    parentId: text('parent_id').$type<ID>().notNull(),
    parentType: text('parent_type').notNull(),
    creatorId: text('creator_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('comment_threads_parent_id_idx').on(t.parentId),
    index('comment_threads_creator_id_idx').on(t.creatorId),
  ],
);

/**
 * Comments hang off a thread. Hard DELETE (no soft-delete): deleting the
 * thread's first comment deletes the thread row, and the cascade removes the
 * rest — matching CommentService.delete.
 */
export const comments = pgTable(
  'comments',
  {
    id: text('id').$type<ID<'Comment'>>().primaryKey(),
    threadId: text('thread_id')
      .$type<ID<'CommentThread'>>()
      .notNull()
      .references(() => commentThreads.id, { onDelete: 'cascade' }),
    creatorId: text('creator_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: jsonb('body').$type<RichTextDocument>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    modifiedAt: timestamp('modified_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('comments_thread_id_idx').on(t.threadId),
    index('comments_creator_id_idx').on(t.creatorId),
  ],
);

// ─── Posts ───────────────────────────────────────────────────────────────────

export const postTypeEnum = pgEnum('post_type', ['Note', 'Story', 'Prayer']);

// 5-value to match Neo4j exactly: 'ProjectTeam' is a deprecated alias for
// 'Membership' and is stored verbatim.
// migration-todo: post-cutover, consider collapsing 'ProjectTeam' -> 'Membership'.
export const postShareabilityEnum = pgEnum('post_shareability', [
  'Membership',
  'ProjectTeam',
  'Internal',
  'AskToShareExternally',
  'External',
]);

/**
 * Posts attach to any Postable resource (Language/Partner/Project) via a
 * polymorphic FK-less parent_id + parent_type discriminator. Membership
 * shareability is enforced in the repo against project_members.
 */
export const posts = pgTable(
  'posts',
  {
    id: text('id').$type<ID<'Post'>>().primaryKey(),
    parentId: text('parent_id').$type<ID>().notNull(),
    parentType: text('parent_type').notNull(),
    creatorId: text('creator_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: postTypeEnum('type').$type<PostType>().notNull(),
    shareability: postShareabilityEnum('shareability')
      .$type<PostShareability>()
      .notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    modifiedAt: timestamp('modified_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('posts_parent_id_idx').on(t.parentId),
    index('posts_creator_id_idx').on(t.creatorId),
  ],
);

// ─── Audit log ───────────────────────────────────────────────────────────

export const mutationActionEnum = pgEnum('mutation_action', [
  'Create',
  'Update',
  'Delete',
]);

/**
 * Append-only log of resource mutations (the general audit log). One row per
 * create/update/delete, written by an in-transaction hook so it's atomic with
 * the mutation. `resource_id` is FK-less/polymorphic (spans every resource
 * table); `actor_id` set-null on user delete so history outlives the actor.
 * `role_at_time` snapshots the actor's roles at write time (plain text, not the
 * live role enum). `changes` holds the diffed field set (jsonb).
 *
 * The actor is EITHER a user or a system agent, never both — see migration 0027
 * for why the agent side stores a name snapshot instead of an FK, and why
 * `impersonator_id` needs no such treatment.
 */
export const resourceMutations = pgTable(
  'resource_mutations',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').$type<ID>().notNull(),
    action: mutationActionEnum('action').notNull(),
    actorId: text('actor_id')
      .$type<ID<'User'>>()
      .references(() => users.id, { onDelete: 'set null' }),
    /**
     * The SystemAgent that acted, by NAME ('Ghost' | 'Anonymous' | ...), when
     * the actor was not a user. A snapshot, not a reference — same reasoning as
     * `role_at_time`.
     */
    actorSystemAgent: text('actor_system_agent'),
    /**
     * The real, requesting user when `actor_id` is being impersonated. Always a
     * user (an impersonator can't be a system agent), so a plain FK suffices.
     */
    impersonatorId: text('impersonator_id')
      .$type<ID<'User'>>()
      .references(() => users.id, { onDelete: 'set null' }),
    roleAtTime: text('role_at_time').array().notNull().default([]),
    changes: jsonb('changes'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // `<= 1`, not `= 1`: a write with no session in context has no actor at all.
    check(
      'resource_mutations_actor_shape_chk',
      sql`num_nonnulls(${t.actorId}, ${t.actorSystemAgent}) <= 1`,
    ),
    index('resource_mutations_resource_idx').on(
      t.resourceType,
      t.resourceId,
      t.at,
    ),
    index('resource_mutations_actor_id_idx').on(t.actorId),
    index('resource_mutations_impersonator_id_idx').on(t.impersonatorId),
  ],
);

// ─── Progress Report Media ───────────────────────────────────────────────────

export const progressReportMediaCategoryEnum = pgEnum(
  'progress_report_media_category',
  [
    'Team',
    'WorkInProgress',
    'CommunityEngagement',
    'LifeInCommunity',
    'Events',
    'SceneryLandscape',
    'Other',
  ],
);

/**
 * Media (image/video/audio) attached to a ProgressReport. Each row carries one
 * `variant` (draft/translated/fpm/published); rows sharing a `variant_group_id`
 * are the "same image" across variants (≤1 row per (group, variant)). The
 * `file_id` is a DefinedFile placeholder created by FileService.createDefinedFile
 * after the row lands (so it's FK-less here, like other defined-file columns);
 * the media sidecar is reached via that file's latest FileVersion.
 *
 * The Neo4j VariantGroup node collapses to a plain `variant_group_id` here — a
 * group "exists" exactly as long as some media references it (matching the
 * Neo4j deleteVariantGroupIfEmpty cleanup).
 */
export const progressReportMedia = pgTable(
  'progress_report_media',
  {
    id: text('id').$type<ID>().primaryKey(),
    reportId: text('report_id')
      .$type<ID<'ProgressReport'>>()
      .notNull()
      .references(() => periodicReports.id),
    variant: text('variant').notNull(),
    category:
      progressReportMediaCategoryEnum('category').$type<MediaCategory>(),
    variantGroupId: text('variant_group_id')
      .$type<ID<'ProgressReportMediaVariantGroup'>>()
      .notNull(),
    // DefinedFile placeholder; created by createDefinedFile after this row.
    fileId: text('file_id').$type<ID<'File'>>(),
    creatorId: text('creator_id')
      .$type<ID<'User'>>()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('progress_report_media_report_id_idx').on(t.reportId),
    index('progress_report_media_variant_group_id_idx').on(t.variantGroupId),
    index('progress_report_media_creator_id_idx').on(t.creatorId),
    // One live row per (variant_group, variant) — the DB fail-safe behind the
    // repository's SELECT-then-INSERT check, which is a TOCTOU race on its own.
    // Goes beyond Neo4j, which has no equivalent constraint; safe to adopt
    // because prod carries 8076 media rows with zero duplicate pairs.
    uniqueIndex('progress_report_media_group_variant_active_unique')
      .on(t.variantGroupId, t.variant)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ─── PnP Extraction Results ──────────────────────────────────────────────────

/**
 * Result of parsing a PnP spreadsheet, keyed by the File it was extracted from
 * (one result per File — a LanguageEngagement.pnp or ProgressReport.reportFile).
 * The concrete Planning/Progress flavor isn't stored — it's implied by which
 * resource's file this is, resolved by the consuming field's type.
 */
export const pnpExtractionResults = pgTable('pnp_extraction_results', {
  // An extraction result has no life of its own without its File, so the
  // lifetime follows it. Note what CASCADE does and does not buy: file_nodes is
  // SOFT-deleted, so ordinary deletion sets deleted_at and this never fires —
  // the result simply becomes unreachable, since every read arrives via the
  // file. The cascade earns its keep on a real DELETE (a hard purge, or a
  // rollback), and the FK itself is what stops a result pointing at no file.
  // The problems table already cascades from here, so the chain completes.
  fileId: text('file_id')
    .$type<ID<'File'>>()
    .primaryKey()
    .references(() => fileNodes.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Problems found during extraction. `type` is a PnpProblemType uuid (its
 * severity + render live in code, not the DB); `source` is "Sheet!A1"; context
 * is the type-specific render input.
 */
export const pnpExtractionResultProblems = pgTable(
  'pnp_extraction_result_problems',
  {
    id: text('id').$type<ID>().primaryKey(),
    fileId: text('file_id')
      .$type<ID<'File'>>()
      .notNull()
      .references(() => pnpExtractionResults.fileId, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    source: text('source').notNull(),
    context: jsonb('context').$type<Record<string, unknown>>().notNull(),
  },
  (t) => [index('pnp_extraction_result_problems_file_id_idx').on(t.fileId)],
);
