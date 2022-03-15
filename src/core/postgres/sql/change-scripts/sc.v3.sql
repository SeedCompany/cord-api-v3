-- Seed Company Schema -------------------------------------------------------------

create schema sc;

-- POSTS ----------------------------------------------------------

create type sc.post_shareability as enum (
  'sc_projects_id Team',
  'Internal',
  'Ask to Share Externally',
  'External'
);

create type sc.post_type as enum (
  'Note',
  'Story',
  'Prayer'
);

create table sc.posts (
  id uuid primary key default common.uuid_generate_v4(),

  parent uuid,
  parent_type admin.table_name,
  common_directories_id uuid references common.directories(id), -- not null
  type sc.post_type, --not null,
  shareability sc.post_shareability, --not null,
  body text, --not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

-- ACCOUNTING TABLES --------------------------------------------------------

create table sc.funding_accounts (
  id uuid primary key default common.uuid_generate_v4(),

	account_number int unique, -- not null,
	name varchar(255),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

-- common_locations_id TABLES ----------------------------------------------------------

-- todo Ken to review in DOMO
create table sc.field_zones (
	id uuid primary key default common.uuid_generate_v4(),

	director_admin_people_id uuid references admin.people(id),
	name varchar(32) unique, -- not null

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

-- todo Ken to review in DOMO
create table sc.field_regions (
	id uuid primary key default common.uuid_generate_v4(),
	sc_field_zone_id uuid references sc.field_zones(id),

	director_admin_people_id uuid references admin.people(id),
	name varchar(32) unique, -- not null

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create table sc.locations (
	id uuid unique not null references common.locations(id),

  -- todo research using aliases
	default_region uuid references sc.field_regions(id),
	funding_account uuid references sc.funding_accounts(id),
	sensitivity common.sensitivity not null default 'High',

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create table sc.field_region_locations (
	id uuid unique not null references common.locations(id),

	sc_field_regions_id uuid references sc.field_regions(id),
	common_locations_id uuid references common.locations(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create table sc.field_zone_locations (
	id uuid unique not null references common.locations(id),

	sc_field_zones_id uuid references sc.field_zones(id),
	common_locations_id uuid references common.locations(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

-- common_organizations_id TABLES

create type sc.periodic_report_type as enum (
  'Financial',
  'Narrative',
  'Progress'
);

DO $$ BEGIN
    create type sc.financial_reporting_types as enum (
		'Funded',
		'FieldEngaged'
	);
	EXCEPTION
	WHEN duplicate_object THEN null;
END; $$;

DO $$ BEGIN
    create type sc.partner_types as enum (
		'Managing',
		'Funding',
		'Impact',
		'Technical',
		'Resource'
	);
	EXCEPTION
	WHEN duplicate_object THEN null;
END; $$;

create table sc.partners (
	id uuid primary key references common.organizations(id),

	active bool,
	financial_reporting_types sc.financial_reporting_types[],
	is_innovations_client bool,
	pmc_entity_code varchar(32),
	point_of_contact_people_id uuid references admin.people(id),
	types sc.partner_types[],
	address varchar(255),
	sensitivity common.sensitivity,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

-- language_common_languages_id TABLES ----------------------------------------------------------

--create table sc.ethnologue (
--  id uuid primary key default common.uuid_generate_v4(),
--
--  language_index uuid not null references sil.language_index(id),
--  code varchar(32),
--  language_name varchar(64), -- override for language_index
--  population int,
--  provisional_code varchar(32),
--
--  created_at timestamp not null default CURRENT_TIMESTAMP,
--  created_by_admin_people_id uuid not null references admin.people(id),
--  modified_at timestamp not null default CURRENT_TIMESTAMP,
--  modified_by_admin_people_id uuid not null references admin.people(id),
--  owning_person_admin_people_id uuid not null references admin.people(id),
--  owning_group_admin_groups_id uuid not null references admin.groups(id)
--);

create type sc.least_reached_progress_scale as enum (
    '0',
		'1',
		'2',
		'3',
		'4',
		'5'
);

create type sc.partner_interest_scale as enum (
		'NoPartnerInterest',
		'Some',
		'Significant',
		'Considerable'
);

create type sc.multiple_languages_leverage_linguistic_scale as enum (
		'None',
		'Some',
		'Significant',
		'Considerable',
		'Large',
		'Vast'
);

create type sc.multiple_languages_leverage_joint_training_scale as enum (
		'None',
		'Some',
		'Significant',
		'Considerable',
		'Large',
		'Vast'
);

create type sc.lang_comm_int_in_language_development_scale as enum (
		'NoInterest',
		'Some',
		'Significant',
		'Considerable'
);

create type sc.lang_comm_int_in_scripture_translation_scale as enum (
		'NoInterest',
		'Some',
		'ExpressedNeed',
		'Significant',
		'Considerable'
);

create type sc.access_to_scripture_in_lwc_scale as enum (
		'FullAccess',
		'VastMajority',
		'LargeMajority',
		'Majority',
		'Significant',
		'Some',
		'Few'
);

create type sc.begin_work_geo_challenges_scale as enum (
		'None',
		'VeryDifficult',
		'Difficult',
		'Moderate',
		'Easy'
);

create type sc.begin_work_rel_pol_obstacles_scale as enum (
		'None',
		'VeryDifficult',
		'Difficult',
		'Moderate',
		'Easy'
);

create table sc.languages(
	id uuid primary key references common.languages(id),

  sc_ethnologue_id uuid references sc.ethnologue(id),
  name varchar(255) unique, -- not null
  display_name varchar(255) unique, -- not null
  display_name_pronunciation varchar(255),
  tags text[],
  is_preset_inventory bool, -- if false = grandfathered
  is_dialect bool,
  is_sign_language bool,
  is_least_of_these bool, -- todo is going away, keep for historical
  least_of_these_reason varchar(255),
  population_override int,
  provisional_code char(3),
  registry_of_dialects_code char(5),
  sensitivity common.sensitivity,
  sign_language_code char(4),
  sponsor_start_date date, -- derived
  sponsor_estimated_end_date date, -- todo research this field. new?
  has_external_first_scripture bool,

--	language_name varchar(32),
--	iso varchar(4),

	prioritization decimal generated always as (
	  population_value * 2 +
	  egids_value * 3 +
	  least_reached_value * 2 +
	  partner_interest_value * 2 +
	  multiple_languages_leverage_linguistic_value * 1 +
	  multiple_languages_leverage_joint_training_value * 1 +
	  lang_comm_int_in_language_development_value * 1 +
	  lang_comm_int_in_scripture_translation_value * 1 +
	  access_to_scripture_in_lwc_value * 1 +
	  begin_work_geo_challenges_value * 0.5 +
	  begin_work_rel_pol_obstacles_value * 0.5
	) stored,
	progress_bible bool,

  location_long text,
	island varchar(32),
	province varchar(32),

	first_language_population int,
	population_value decimal default 0, -- calculated from first_language_population

	egids_level common.egids_scale,
	egids_value decimal default 0, -- calculated from _level

  -- todo research removing value columns
	least_reached_progress_jps_level sc.least_reached_progress_scale,
	least_reached_value decimal default 0, -- calculated from _level

  partner_interest_level sc.partner_interest_scale,
	partner_interest_value decimal default 0, -- calculated from _level
	partner_interest_description text,
	partner_interest_source text,

  multiple_languages_leverage_linguistic_level sc.multiple_languages_leverage_linguistic_scale,
	multiple_languages_leverage_linguistic_value decimal default 0, -- calculated from _level
	multiple_languages_leverage_linguistic_description text,
	multiple_languages_leverage_linguistic_source text,

  multiple_languages_leverage_joint_training_level sc.multiple_languages_leverage_joint_training_scale,
	multiple_languages_leverage_joint_training_value decimal default 0, -- calculated from _level
  multiple_languages_leverage_joint_training_description text,
  multiple_languages_leverage_joint_training_source text,

  lang_comm_int_in_language_development_level sc.lang_comm_int_in_language_development_scale,
	lang_comm_int_in_language_development_value decimal default 0, -- calculated from _level
	lang_comm_int_in_language_development_description text,
	lang_comm_int_in_language_development_source text,

  lang_comm_int_in_scripture_translation_level sc.lang_comm_int_in_scripture_translation_scale,
	lang_comm_int_in_scripture_translation_value decimal default 0, -- calculated from _level
	lang_comm_int_in_scripture_translation_description text,
	lang_comm_int_in_scripture_translation_source text,

  access_to_scripture_in_lwc_level sc.access_to_scripture_in_lwc_scale,
	access_to_scripture_in_lwc_value decimal default 0, -- calculated from _level
	access_to_scripture_in_lwc_description text,
	access_to_scripture_in_lwc_source text,

  begin_work_geo_challenges_level sc.begin_work_geo_challenges_scale,
	begin_work_geo_challenges_value decimal default 0, -- calculated from _level
	begin_work_geo_challenges_description text,
	begin_work_geo_challenges_source text,

  begin_work_rel_pol_obstacles_level sc.begin_work_rel_pol_obstacles_scale,
	begin_work_rel_pol_obstacles_value decimal default 0, -- calculated from _level
  begin_work_rel_pol_obstacles_description text,
  begin_work_rel_pol_obstacles_source text,

  coordinates common.geography,
	suggested_strategies text,
	comments text,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create table sc.language_goal_definitions (
	id uuid primary key default common.uuid_generate_v4(),

	-- todo

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create table sc.language_goals (
  id uuid primary key default common.uuid_generate_v4(),

  common_languages_id uuid not null references common.languages(id),
	sc_language_goal_definitions_id uuid not null references sc.language_goal_definitions(id),
	-- todo

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

	unique (common_languages_id, sc_language_goal_definitions_id)
);

-- USER TABLES --------------------------------------------------------------

create table sc.known_languages_by_person (
  id uuid primary key default common.uuid_generate_v4(),

  admin_people_id uuid unique not null references admin.people(id),
  sc_languages_id uuid not null references common.languages(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

	unique (admin_people_id, sc_languages_id)
);

-- extension table from commmon
create table sc.people (
  id uuid primary key references admin.people(id),

	skills varchar(32)[],
	status varchar(32), -- todo might be an enum
	title varchar(255),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create table sc.person_unavailabilities (
  id uuid primary key default common.uuid_generate_v4(),

  admin_people_id uuid references admin.people(id),
	period_start date not null,
	period_end date not null,
	description text,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);


-- sc_projects_id TABLES ----------------------------------------------------------

create type sc.project_step as enum (
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
		'Completed'
);

create type sc.project_status as enum (
		'InDevelopment',
		'Active',
		'Terminated',
		'Completed',
		'DidNotDevelop'
);

create type sc.project_type as enum (
        'Translation',
        'Internship'
);

-- todo
create type sc.change_set_type as enum (
		'a',
		'b',
		'c'
);

-- todo
create type sc.change_set_status as enum (
		'a',
		'b',
		'c'
);

create table sc.change_sets (
  id uuid primary key default common.uuid_generate_v4(),

  status sc.change_set_status,
  summary text,
  type sc.change_set_type,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create type sc.periodic_report_parent_type as enum (
		'a',
		'b',
		'c'
);

create table sc.periodic_reports (
  id uuid primary key default common.uuid_generate_v4(),

  parent uuid,
  type sc.periodic_report_parent_type,
  common_directories_id uuid references common.directories(id),
  end_at date,
  report_common_files_id uuid references common.files(id),
  start_at date,
  type sc.periodic_report_type,
  skipped_reason text,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create type sc.financial_report_period_type as enum (
		'Monthly',
		'Quarterly'
);

-- extension table to common
create table sc.projects (
  id uuid primary key default common.uuid_generate_v4(),

	name varchar(32), -- not null
	sc_change_set_id uuid references sc.change_sets(id), -- not null
	department_id varchar(5),
	estimated_submission date,
	sc_field_regions_id uuid references sc.field_regions(id),
	financial_report_period sc.financial_report_period_type default 'Quarterly',
	initial_mou_end date,
	marketing_common_locations_id uuid references common.locations(id),
	mou_start date,
	mou_end date,
	primary_common_locations_id uuid references common.locations(id),
	root_directory_common_directories_id uuid references common.directories(id),
	status sc.project_status, -- not null todo
	step sc.project_step, -- not null todo
	step_changed_at timestamp,
	sensitivity common.sensitivity, -- not null todo
	tags text[],
	type sc.project_type,
	financial_report_received_at timestamp, -- legacy, not in api

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

	unique (id, sc_change_set_id)
);

create table sc.translation_projects (
  id uuid primary key default sc.projects(),
  sc_change_set_id uuid references sc.change_sets(id), -- not null

	preset_inventory bool,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

	unique (id, sc_change_set_id)
);

create table sc.internship_projects (
  id uuid primary key default sc.projects(),
  sc_change_set_id uuid references sc.change_sets(id), -- not null

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

	unique (id, sc_change_set_id)
);

create table sc.project_members (
  id uuid primary key default common.uuid_generate_v4(),

	sc_projects_id uuid references sc.projects(id), --not null
	admin_people_id uuid references admin.people(id), --not null
	admin_groups_id uuid unique references admin.groups(id), --not null
	admin_role_id uuid references admin.roles(id), --not null

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

  unique (sc_projects_id, admin_people_id, admin_groups_id, admin_role_id)
);

create type sc.pinned_types as enum (
		'LanguageProject',
		'InternshipProject',
		'TranslationEngagement',
		'InternshipEngagement',
		'language_common_languages_id',
		'Partner',
		'sc_products_id'
);

create table sc.pinned (
  id uuid primary key default common.uuid_generate_v4(),
	admin_people_id uuid unique references admin.people(id), -- not null
	pinned uuid, -- not null
	type sc.pinned_types, -- not null

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create type sc.partnership_agreement_status as enum (
		'NotAttached',
		'AwaitingSignature',
		'Signed'
);

create table sc.partnerships (
  id uuid primary key default common.uuid_generate_v4(),

  sc_projects_id uuid references sc.projects(id), -- not null
  partner_common_organizations_id uuid references common.organizations(id), -- not null
  sc_change_set_id uuid references sc.change_sets(id), -- not null
  agreement_status sc.partnership_agreement_status,
  mou uuid references common.files(id),
  agreement uuid references common.files(id),
  mou_status sc.partnership_agreement_status,
  mou_start date, -- derived from sc.projects unless overridden
  mou_end date, -- derived from sc.projects unless overridden
  mou_start_override date,
  mou_end_override date,
  financial_reporting_type sc.financial_reporting_types,
  is_primary bool,
  sensitivity common.sensitivity,

  types sc.partner_types[],  -- added because exists in neo4j

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)

);

-- sc_projects_id BUDGETS

create type common.budget_status as enum (
		'Pending',
		'Current',
		'Superseded',
		'Rejected'
);

create table sc.budgets (
  id uuid primary key default common.uuid_generate_v4(),

  sc_change_set_id uuid, -- not null
  sc_projects_id uuid references sc.projects(id), -- not null
  status common.budget_status,
  universal_template uuid references common.files(id),
  sensitivity common.sensitivity, -- derived from sc.projects

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

  unique (id, sc_change_set_id)
);

create table sc.budget_records (
  id uuid primary key default common.uuid_generate_v4(),

  sc_budgets_id uuid references sc.budgets(id), -- not null
  sc_change_set_id uuid references sc.change_sets(id), -- not null
  amount decimal,
  fiscal_year int,
  partnership uuid not null references sc.partnerships(id),
  sensitivity common.sensitivity, -- derived from sc.projects

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),
  peer uuid references admin.peers(id)

);

-- sc_projects_id common_locations_id

create table sc.project_locations (
  id uuid primary key default common.uuid_generate_v4(),

  sc_change_set_id uuid references sc.change_sets(id), -- not null
  common_locations_id uuid references common.locations(id), -- not null
  sc_projects_id uuid references sc.projects(id), -- not null

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

	unique (sc_projects_id, common_locations_id, sc_change_set_id)
);

-- PRODUCTS

create type common.product_mediums_enum as enum (
  'Print',
  'Web',
  'EBook',
  'App',
  'TrainedStoryTellers',
  'Audio',
  'Video',
  'Other'
);

create type common.product_methodologies as enum (
  'AdobeAudition',
  'Audacity',
  'Craft2Tell',
  'Film',
  'OneStory',
  'OtherOralStories',
  'OtherOralTranslation',
  'OtherWritten',
  'OtherVisual',
  'Paratext',
  'Render',
  'SeedCompanyMethod',
  'SignLanguage',
  'StoryTogether'
 );

create type common.product_approach as enum (
  'OralStories',
  'OralTranslation',
  'Visual',
  'Written'
);

create type common.product_purposes as enum (
  'EvangelismChurchPlanting',
  'ChurchLife',
  'ChurchMaturity',
  'SocialIssues',
  'Discipleship'
);

-- move to table - films stories ethnoart
-- names and scripture references
--create type sc.product_type as enum (
--  'BibleStories',
--  'EthnoArts',
--  'Film',
--  'FullBible',
--  'Genesis',
--  'Gospel',
--  'IndividualBooks',
--  'JesusFilm',
--  'LiteracyMaterials',
--  'NewTestamentFull',
--  'OldTestamentPortions',
--  'OldTestamentFull',
--  'Songs',
--  'Story'
--);

create type common.progress_measurement as enum (
  'Percent',
  'Number',
  'Boolean'
);

create type common.product_steps_enum as enum (
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
    'Completed'
);

create type sc.producible_types as enum (
  'Film',
  'Story',
  'EthnoArt'
);

create table sc.products (
  id uuid primary key default common.uuid_generate_v4(),

  sc_change_set_id uuid references sc.change_sets(id), -- not null
  sc_language_engagements_id uuid references sc.language_engagements(id),
  mediums common.product_mediums_enum[],
  purposes common.product_purposes[], -- todo may need for historical data, delete
  methodology common.product_methodologies,
  sensitivity common.sensitivity,
  steps common.product_steps_enum[],
  describe_completion text,
  progress_step_measurement common.progress_measurement,
  progress_target decimal,
  placeholder_description text,

  -- todo, are these needed now that we have the 3 products tables?
  -- pnp_index int,
  -- total verses,
  -- total verse equivalents -- derived from scripture references
  -- name varchar(64), -- not null
  -- active bool,
  -- type sc.product_type,
  -- description text,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

  unique (id, sc_change_set_id)
);

create table sc.direct_scripture_products (
  id uuid references sc.products(id),

  common_scripture_references_id uuid[],
  total_verses int,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

  unique (id, sc_change_set_id)
);

create table sc.derivative_products (
  id uuid references sc.products(id),

  composite bool,
  producible uuid, -- not null
  type sc.producible_types, -- not null,
  scripture_reference_override_common_scripture_references_id uuid references common.scripture_references(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

  unique (id, sc_change_set_id)
);

create table sc.other_products (
  id uuid references sc.products(id),

  title varchar(128),
  description text,
  common_scripture_references_id uuid[],
  total_verses int,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

  unique (id, sc_change_set_id)
);

create table sc.product_scripture_references (
  id uuid primary key default common.uuid_generate_v4(),
  sc_products_id uuid references sc.products(id), -- not null
  common_scripture_references_id uuid references common.scripture_references(id), -- not null
  sc_change_set_id uuid references sc.change_sets(id), -- not null

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

  unique (id)
);

create table sc.product_progress (
  id uuid primary key default common.uuid_generate_v4(),

  sc_products_id uuid references sc.products(id),
  sc_periodic_reports_id uuid references sc.periodic_reports(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create table sc.step_progress (
  id uuid primary key default common.uuid_generate_v4(),

  sc_product_progress_id uuid references sc.product_progress(id),
  step common.product_steps_enum,
  completed decimal,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create type sc.report_period_enum as enum (
  'Monthly',
  'Quarterly',
  'FiscalYearToDate',
  'Cumulative'
);

create table sc.progress_summary (
  id uuid primary key default common.uuid_generate_v4(),

  actual decimal,
  planned decimal,
  report_period sc.report_period_enum, -- not null

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

-- INTERNSHIP ENGAGEMENTS

-- todo
create type common.internship_methodology as enum (
  'A',
  'B',
  'C'
);

create type common.internship_position as enum (
  'ConsultantInTraining',
  'ExegeticalFacilitator',
  'LeadershipDevelopment',
  'Mobilization',
  'Personnel',
  'Communication',
  'Administration',
  'Technology',
  'Finance',
  'LanguageProgramManager',
  'Literacy',
  'TranslationFacilitator',
  'OralityFacilitator',
  'ScriptureEngagement',
  'OtherAttached',
  'OtherTranslationCapacity',
  'OtherPartnershipCapacity'
);

create type sc.engagement_types_enum as enum (
  'language_common_languages_id',
  'Internship'
);

create table sc.engagements (
  id uuid primary key default common.uuid_generate_v4(),

	sc_projects_id uuid references sc.projects(id), -- not null
	engagement_type sc.engagement_types_enum, -- not null
  status common.engagement_status, not null
  ceremony id not null
  complete_date date,
  disbursement_complete_date date,
  end_date date,
  end_date_override date,
  start_date date,
  start_date_override date,
  sensitivity derived from sc.projects
  initial_end_date date,
  last_suspended_at timestamp,
  last_reactivated_at timestamp,
  status_modified_at timestamp,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

	unique (sc_projects_id, language_common_languages_id, sc_change_set_id)
);

create type common.engagement_status as enum (
		'InDevelopment',
		'DidNotDevelop',
		'Active',
		'DiscussingTermination',
		'DiscussingReactivation',
		'DiscussingChangeToPlan',
		'DiscussingSuspension',
		'FinalizingCompletion',
		'ActiveChangedPlan',
		'Suspended',
		'Terminated',
		'Completed',
		'Converted',
		'Unapproved',
		'Transferred',
		'NotRenewed',
		'Rejected'
);

-- todo
create type common.project_engagement_tag as enum (
		'A',
		'B',
		'C'
);

create table sc.language_engagements (
  id uuid primary key references sc.engagements(id),

	common_languages_id uuid references common.languages(id), -- not null
	sc_change_set_id uuid references sc.change_sets(id), -- not null
  communications_complete_date date,
  is_open_to_investor_visit bool,
  is_first_scripture bool,
  is_luke_partnership bool,
  sent_printing_date date,
  paratext_registry varchar(64),
  pnp_common_files_id uuid references common.files(id),
  historic_goal varchar(255),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

	unique (sc_projects_id, language_common_languages_id, sc_change_set_id)
);

create table sc.internship_engagements (
  id uuid primary key references sc.engagements(id),

	sc_change_set_id uuid references sc.change_sets(id), -- not null
  country_of_origin_common_locations_id uuid references common.locations(id),
  intern_admin_people_id uuid references admin.people(id), -- not null
  mentor_admin_pepole_id uuid references admin.people(id),
  methodologies common.product_methodologies[],
  position common.internship_position,
  growth_plan_common_files_id uuid references common.files(id), --references files, not file-versions in neo4j

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create table sc.partnership_producing_mediums (
  id uuid primary key references sc.engagements(id),

  engagement_sc_engagements_id uuid references sc.engagements(id), -- not null
  partnership_sc_partnerships_id uuid references sc.partnerships(id), -- not null
  product_medium sc.product_mediums_enum, -- not null

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

-- CEREMONIES

create type common.ceremony_type as enum (
  'Dedication',
  'Certification'
);

create table sc.ceremonies (
  id uuid primary key default common.uuid_generate_v4(),

  sc_language_engagements_id uuid, -- not null
  engagement_type sc.engagement_types_enum, -- not null
  ethnologue_sil_table_of_languages_id uuid references sil.table_of_languages(id),
  actual_date date,
  estimated_date date,
  is_planned bool,
  type common.ceremony_type,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

-- PARTNER CRM STUFF ---------------------------------------------------------------------------------------------------

create type sc.partner_maturity_scale as enum (
  'Level 1', -- Non-Existent or Reactive
  'Level 2', -- Repeatable and Active
  'Level 3', -- Proactive and Defined
  'Level 4'  -- Fully Capable and Managed
);

create table sc.global_partner_assessments (
  id uuid primary key default common.uuid_generate_v4(),

  partner_common_organizations_id uuid not null references common.organizations(id),

  governance_trans          sc.partner_maturity_scale,
  director_trans            sc.partner_maturity_scale,
  identity_trans            sc.partner_maturity_scale,
  growth_trans              sc.partner_maturity_scale,
  comm_support_trans        sc.partner_maturity_scale,
  systems_trans             sc.partner_maturity_scale,
  fin_management_trans      sc.partner_maturity_scale,
  hr_trans                  sc.partner_maturity_scale,
  it_trans                  sc.partner_maturity_scale,
  program_design_trans      sc.partner_maturity_scale,
  tech_translation_trans    sc.partner_maturity_scale,
  director_opp              sc.partner_maturity_scale,
  financial_management_opp  sc.partner_maturity_scale,
  program_design_opp        sc.partner_maturity_scale,
  tech_translation_opp      sc.partner_maturity_scale,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create type sc.partner_performance_options as enum(
  '1', '2', '3', '4'
);

create table sc.global_partner_performance (
  id uuid primary key default common.uuid_generate_v4(),

  common_organizations_id uuid unique not null references common.organizations(id),

  reporting_performance sc.partner_performance_options,
  financial_performance sc.partner_performance_options,
  translation_performance sc.partner_performance_options,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create type sc.global_partner_transition_options as enum(
  'common_organizations_id Assessment',
  'Development'
);

 create table sc.global_partner_transitions (
   id uuid primary key default common.uuid_generate_v4(),

   common_organizations_id uuid unique not null references common.organizations(id),
   transition_type sc.global_partner_transition_options not null,
   effective_date date,

   created_at timestamp not null default CURRENT_TIMESTAMP,
   created_by_admin_people_id uuid not null references admin.people(id),
   modified_at timestamp not null default CURRENT_TIMESTAMP,
   modified_by_admin_people_id uuid not null references admin.people(id),
   owning_person_admin_people_id uuid not null references admin.people(id),
   owning_group_admin_groups_id uuid not null references admin.groups(id)
 );

create type sc.global_partner_roles as enum (
  'A',
  'B'
);

create table sc.global_partner_engagements (
  id uuid primary key default common.uuid_generate_v4(),

  common_organizations_id uuid not null references common.organizations(id),
  type common.involvement_options not null,
  mou_start date,
  mou_end date,
  sc_roles sc.global_partner_roles[],
  partner_roles sc.global_partner_roles[],

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

  unique (common_organizations_id, type)
);

create table sc.global_partner_engagement_people (
  id uuid primary key default common.uuid_generate_v4(),

  sc_global_partner_engagements_id uuid not null references sc.global_partner_engagements(id),
  admin_people_id uuid not null references admin.people(id),
  admin_role_id common.people_to_org_relationship_type not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id),

  unique (sc_language_engagements_id, admin_people_id, admin_role_id)
);
