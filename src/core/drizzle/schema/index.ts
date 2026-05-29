import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  jsonb,
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
import { type PartnerType } from '../../../components/partner/dto/partner-type.enum';
import { type FinancialReportingType } from '../../../components/partnership/dto/financial-reporting-type.enum';
import { type ReportPeriod } from '../../../components/periodic-report/dto/report-period.enum';
import { type ProjectChangeRequestStatus } from '../../../components/project-change-request/dto/project-change-request-status.enum';
import { type ProjectChangeRequestType } from '../../../components/project-change-request/dto/project-change-request-type.enum';
import { type ProjectStatus } from '../../../components/project/dto/project-status.enum';
import { type ProjectStep } from '../../../components/project/dto/project-step.enum';
import { type ProjectType } from '../../../components/project/dto/project-type.enum';
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
    // migration-todo: add FK constraint once FundingAccount is migrated to PG
    fundingAccountId: text('funding_account_id').$type<ID<'FundingAccount'>>(),
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

// ─── Partner ────────────────────────────────────────────────────────────────

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

export const projectChangeRequestStatusEnum = pgEnum(
  'project_change_request_status',
  ['Pending', 'Approved', 'Rejected'],
);

export const projectChangeRequestTypeEnum = pgEnum(
  'project_change_request_type',
  ['Time', 'Budget', 'Goal', 'Engagement', 'Other'],
);

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
    // migration-todo: deferred FK → directories(id); add REFERENCES when File
    // migrates (Tier 7). Plain text until then.
    rootDirectoryId: text('root_directory_id').$type<ID<'Directory'>>(),
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
    // Deferred FK column — indexed now so we avoid CREATE INDEX CONCURRENTLY
    // later when File adds the REFERENCES clause.
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
  ],
);

/**
 * ProjectChangeRequest — the only concrete subtype of the abstract Changeset
 * concept; no separate `changesets` base table. Fields that the Neo4j/Gel
 * version inherits from Changeset (status, applied, editable, types, summary)
 * live on this table directly.
 */
export const projectChangeRequests = pgTable(
  'project_change_requests',
  {
    id: text('id').$type<ID<'ProjectChangeRequest'>>().primaryKey(),
    projectId: text('project_id')
      .$type<ID<'Project'>>()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    types: projectChangeRequestTypeEnum('types')
      .array()
      .$type<readonly ProjectChangeRequestType[]>()
      .notNull()
      .default([]),
    summary: text('summary'),
    status: projectChangeRequestStatusEnum('status')
      .$type<ProjectChangeRequestStatus>()
      .notNull()
      .default('Pending'),
    applied: boolean('applied').notNull().default(false),
    editable: boolean('editable').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('project_change_requests_project_id_idx').on(t.projectId)],
);

/**
 * Project overrides — JSONB side table for changeset-staged values. Storage is
 * JSONB; shape is typed at the app layer as `ProjectChangeset` (enumerated
 * keys: mouStart, mouEnd, primaryLocationId, fieldRegionId, marketingLocationId,
 * marketingRegionOverrideId, estimatedSubmission, presetInventory, tags).
 * Apply: write keys onto `projects` and DELETE the row. Reject: DELETE only.
 */
export const projectOverrides = pgTable(
  'project_overrides',
  {
    projectId: text('project_id')
      .$type<ID<'Project'>>()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    projectChangeRequestId: text('project_change_request_id')
      .$type<ID<'ProjectChangeRequest'>>()
      .notNull()
      .references(() => projectChangeRequests.id, { onDelete: 'cascade' }),
    changes: jsonb('changes')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.projectChangeRequestId] }),
    // Right-side index — every PCR-finalize path reads "overrides for PCR X".
    index('project_overrides_project_change_request_id_idx').on(
      t.projectChangeRequestId,
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
  members: many(projectMembers),
  workflowEvents: many(projectWorkflowEvents),
  changeRequests: many(projectChangeRequests),
  overrides: many(projectOverrides),
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

export const projectChangeRequestsRelations = relations(
  projectChangeRequests,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [projectChangeRequests.projectId],
      references: [projects.id],
    }),
    overrides: many(projectOverrides),
  }),
);

export const projectOverridesRelations = relations(
  projectOverrides,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectOverrides.projectId],
      references: [projects.id],
    }),
    projectChangeRequest: one(projectChangeRequests, {
      fields: [projectOverrides.projectChangeRequestId],
      references: [projectChangeRequests.id],
    }),
  }),
);
