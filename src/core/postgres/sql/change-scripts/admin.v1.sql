create schema if not exists admin;
create schema if not exists common;

set schema 'common';

CREATE EXTENSION if not exists hstore;
create extension if not exists postgis;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION nanoid(size int DEFAULT 11)
RETURNS text AS $$
DECLARE
  id text := '';
  i int := 0;
  urlAlphabet char(64) := 'ModuleSymbhasOwnPr-0123456789ABCDEFGHNRVfgctiUvz_KqYTJkLxpZXIjQW';
  bytes bytea := common.gen_random_bytes(size);
  byte int;
  pos int;
BEGIN
  WHILE i < size LOOP
    byte := get_byte(bytes, i);
    pos := (byte & 63) + 1; -- + 1 because substr starts at 1 for some reason
    id := id || substr(urlAlphabet, pos, 1);
    i = i + 1;
  END LOOP;
  RETURN id;
END
$$ LANGUAGE PLPGSQL STABLE;

create type admin.history_event_type as enum (
  'INSERT',
  'UPDATE',
  'DELETE'
);

create type common.sensitivity as enum (
  'Low',
  'Medium',
  'High'
);

create type admin.access_level as enum (
  'Read',
  'Write'
);

create table common_sensitivity_enum (
  value varchar(32) primary key
);

insert into common_sensitivity_enum(value) values('Low'), ('Medium'), ('High');

create table admin_access_level_enum(
  value varchar(32) primary key
);

insert into admin_access_level_enum(value) values('Read'), ('Write');

create table admin_table_name_enum (
  value varchar(64) primary key
);

create type admin.table_name as enum (
  'admin.database_version_control',
  'admin.email_tokens',
  'admin.group_memberships',
  'admin.group_row_access',
  'admin.groups',
  'admin.peers',
  'admin.people',
  'admin.role_column_grants',
  'admin.role_memberships',
  'admin.role_table_permissions',
  'admin.roles',
  'admin.tokens',
  'admin.users',

  'common.blogs',
  'common.blog_posts',
  'common.cell_channels',
  'common.coalition_memberships',
  'common.coalitions',
  'common.directories',
  'common.discussion_channels',
  'common.education_by_person',
  'common.education_entries',
  'common.file_versions',
  'common.files',
  'common.languages',
  'common.locations',
  'common.notes',
  'common.organizations',
  'common.org_chart_positions',
  'common.org_chart_position_graph',
  'common.people_graph',
  'common.people_to_org_relationships',
  'common.posts',
  'up.prayer_requests',
  'up.prayer_notifications',
  'common.scripture_references',
  'common.site_text_strings',
  'common.site_text_translations',
  'common.stage_graph',
  'common.stage_notifications',
  'common.stage_role_column_grants',
  'common.stages',
  'common.threads',
  'common.ticket_assignments',
  'common.ticket_feedback',
  'common.ticket_graph',
  'common.tickets',
  'common.work_estimates',
  'common.work_records',
  'common.workflows',

  'sil.country_codes',
  'sil.language_codes',
  'sil.language_index',
  'sil.iso_639_3',
  'sil.iso_639_3_names',
  'sil.iso_639_3_macrolanguages',
  'sil.iso_639_3_retirements',
  'sil.table_of_countries',
  'sil.table_of_languages',
  'sil.table_of_languages_in_country',

  'sc.budget_records',
  'sc.budget_records_partnerships',
  'sc.budgets',
  'sc.ceremonies',
  'sc.change_to_plans',
  'sc.ethno_arts',
  'sc.ethnologue',
  'sc.field_regions',
  'sc.field_zones',
  'sc.file_versions',
  'sc.films',
  'sc.funding_accounts',
  'sc.global_partner_assessments',
  'sc.global_partner_engagements',
  'sc.global_partner_engagement_people',
  'sc.global_partner_performance',
  'sc.global_partner_transitions',
  'sc.internship_engagements',
  'sc.known_languages_by_person',
  'sc.language_engagements',
  'sc.language_goal_definitions', -- not finished
  'sc.language_goals', -- not finished
  'sc.language_locations', -- not finished
  'sc.languages',
  'sc.locations',
  'sc.organization_locations',
  'sc.organizations',
  'sc.partners',
  'sc.partnerships',
  'sc.people',
  'sc.periodic_reports',
  'sc.periodic_reports_directory',
  'sc.person_unavailabilities',
  'sc.pinned_projects',
  'sc.posts',
  'sc.posts_directory',
  'sc.product_scripture_references',
  'sc.products',
  'sc.project_locations',
  'sc.project_members',
  'sc.projects',
  'sc.stories'

);

-- VERSION CONTROL ---------------------------------------------------

create type admin.db_vc_status as enum (
  'In Progress',
  'Completed',
  'Abandoned'
);

create table admin.database_version_control (
  id varchar(32) primary key default common.nanoid(),
  version int not null,
  status admin.db_vc_status default 'In Progress',
  started timestamp not null default CURRENT_TIMESTAMP,
  completed timestamp
);

-- PEOPLE ------------------------------------------------------------

create table admin.people (
  id varchar(32) primary key default common.nanoid(),

  about text,
  picture_common_files_id varchar(32) references common.files(id),
  private_first_name varchar(32),
  private_last_name varchar(32),
  public_first_name varchar(32),
  public_last_name varchar(32),
  primary_location_common_locations_id varchar(32) references common.locations(id),
  sensitivity_clearance common.sensitivity default 'Low',
  timezone varchar(64),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32), -- not null doesn't work here, on startup
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32), -- not null doesn't work here, on startup
  owning_person_admin_people_id varchar(32), -- not null doesn't work here, on startup
  owning_group_admin_groups_id varchar(32) -- not null doesn't work here, on startup
);

alter table admin.people add constraint admin_people_created_by_people_id_fk foreign key (created_by_admin_people_id) references admin.people(id);
alter table admin.people add constraint admin_people_modified_by_people_id_fk foreign key (modified_by_admin_people_id) references admin.people(id);
alter table admin.people add constraint admin_people_owning_person_people_id_fk foreign key (owning_person_admin_people_id) references admin.people(id);

-- GROUPS --------------------------------------------------------------------

create table admin.groups(
  id varchar(32) primary key default common.nanoid(),

  name varchar(64) not null,
  parent_group_row_access_admin_groups_id varchar(32) references admin.groups(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) references admin.groups(id), -- not null doesn't work here, on startup

  unique (name, owning_group_admin_groups_id)
);

alter table admin.people add constraint admin_people_owning_group_groups_id_fk foreign key (owning_group_admin_groups_id) references admin.groups(id);

create table admin.group_row_access(
  id varchar(32) primary key default common.nanoid(),

  admin_groups_id varchar(32) not null references admin.groups(id),
  admin_table_name_enum_value varchar(64) not null references admin_table_name_enum(value),
  row_id varchar(32) not null,

	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by_admin_people_id varchar(32) not null references admin.people(id),
	modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

  unique (admin_groups_id, admin_table_name_enum_value, row_id)
);

create table admin.group_memberships(
  id varchar(32) primary key default common.nanoid(),

  admin_groups_id varchar(32) not null references admin.groups(id),
  admin_people_id varchar(32) not null references admin.people(id),

	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by_admin_people_id varchar(32) not null references admin.people(id),
	modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

  unique (admin_groups_id, admin_people_id)
);

create table admin.organization_administrators(
  id varchar(32) primary key default nanoid(),

  admin_groups_id varchar(32) not null references admin.groups(id),
  admin_people_id varchar(32) not null references admin.people(id),

	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by_admin_people_id varchar(32) not null references admin.people(id),
	modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

  unique (group_id, person)
);

-- ROLES --------------------------------------------------------------------

create table admin.roles (
	id varchar(32) primary key default common.nanoid(),

	name varchar(255) not null,

	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by_admin_people_id varchar(32) not null references admin.people(id),
	modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

	unique (name, owning_group_admin_groups_id)
);

create table admin.role_column_grants(
	id varchar(32) primary key default common.nanoid(),

	admin_role_id varchar(32) not null references admin.roles(id),
	admin_table_name_enum_value varchar(64) not null references admin_table_name_enum(value),
	column_name varchar(64) not null,
	access_level admin.access_level not null,

	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by_admin_people_id varchar(32) not null references admin.people(id),
	modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

	unique (admin_role_id, admin_table_name_enum_value, column_name)
);

create type admin.table_permission_grant_type as enum (
  'Create',
  'Delete'
);

create table admin.role_table_permissions(
  id varchar(32) primary key default common.nanoid(),

  admin_role_id varchar(32) not null references admin.roles(id),
  admin_table_name_enum_value varchar(64) not null references admin_table_name_enum(value),
  table_permission admin.table_permission_grant_type not null,

	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by_admin_people_id varchar(32) not null references admin.people(id),
	modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

  unique (admin_role_id, admin_table_name_enum_value, table_permission)
);

create table admin.role_memberships (
  id varchar(32) primary key default common.nanoid(),

	admin_role_id varchar(32) not null references admin.roles(id),
	admin_people_id varchar(32) unique not null references admin.people(id),

	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by_admin_people_id varchar(32) not null references admin.people(id),
	modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

	unique(admin_role_id, admin_people_id)
);

create table admin.role_all_data_column_grants(
	id varchar(32) primary key default nanoid(),

	admin_roles_id varchar(32) not null references admin.roles(id),
	admin_table_name_enum_value varchar(64) not null references admin_table_name_enum(value),
	column_name varchar(64) not null,
	access_level admin.access_level not null,

	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by_admin_people_id varchar(32) not null references admin.people(id),
	modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

	unique (admin_roles_id, admin_table_name_enum_value, column_name)
);

-- USERS ---------------------------------------------------------------------

create table admin.user_email_accounts(
  id varchar(32) primary key references admin.people(id), -- not null added in v2

  email varchar(255), -- unique not null
  password varchar(255),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create table admin.user_phone_accounts(
  id varchar(32) primary key references admin.people(id), -- not null added in v2

  phone varchar(64) unique,
  password varchar(255),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

-- AUTHENTICATION ------------------------------------------------------------

create table if not exists admin.tokens (
	id varchar(32) primary key default common.nanoid(),
	token varchar(64) unique not null,
	admin_people_id varchar(32) references admin.people(id),
	created_at timestamp not null default CURRENT_TIMESTAMP
);

-- email tokens

create table admin.email_tokens (
	id varchar(32) primary key default common.nanoid(),
	token varchar(512) unique not null,
	admin_user_id varchar(32) not null references admin.users(id),
	created_at timestamp not null default CURRENT_TIMESTAMP
);

-- PEER to PEER -------------------------------------------------------------

-- not used right now
create table admin.peers (
  id varchar(32) primary key default common.nanoid(),

  admin_people_id varchar(32) unique unique not null references admin.people(id),
  url varchar(128) unique not null,
  peer_approved bool not null default false,
  url_confirmed bool not null default false,
  source_token varchar(64) unique,
  target_token varchar(64) unique,
  session_token varchar(64) unique,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

insert into admin_table_name_enum(value) values
  ('admin_database_version_control'),
  ('admin_email_tokens'),
  ('admin_group_memberships'),
  ('admin_group_row_access'),
  ('admin_groups'),
  ('admin_organization_administrators'),
  ('admin_peers'),
  ('admin_people'),
  ('admin_role_all_data_column_grants'),
  ('admin_role_column_grants'),
  ('admin_role_memberships'),
  ('admin_role_table_permissions'),
  ('admin_roles'),
  ('admin_tokens'),
  ('admin_users');
