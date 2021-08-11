-- system schema. org specific schema should go in an org-specific file.

-- ENUMS ----
create schema if not exists public;

set schema 'public';
CREATE EXTENSION hstore;

DO $$ BEGIN
    create type public.access_level as enum (
          'Read',
          'Write',
          'Admin'
	);
	EXCEPTION
	WHEN duplicate_object THEN null;
END; $$;

-- todo
DO $$ BEGIN
    create type public.mime_type as enum (
          'A',
          'B',
          'C'
	);
	EXCEPTION
	WHEN duplicate_object THEN null;
END; $$;

DO $$ BEGIN
    create type public.sensitivity as enum (
		'Low',
		'Medium',
		'High'
	);
	EXCEPTION
	WHEN duplicate_object THEN null;
END; $$;

DO $$ BEGIN
    create type public.post_type as enum (
		'Note',
		'Story',
		'Prayer'
	);
	EXCEPTION
	WHEN duplicate_object THEN null;
END; $$;

DO $$ BEGIN
    create type public.post_shareability as enum (
		'Project Team',
		'Internal',
		'Ask to Share Externally',
		'External'
	);
	EXCEPTION
	WHEN duplicate_object THEN null;
END; $$;

DO $$ BEGIN
    create type public.periodic_report_type as enum (
		'Financial',
		'Narrative'
	);
	EXCEPTION
	WHEN duplicate_object THEN null;
END; $$;

-- ROLES --------------------------------------------------------------------

create table if not exists public.global_roles_data (
	id serial primary key,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by int not null default 0,
	modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
	name varchar(255) not null,
	org int,
	unique (org, name)
-- foreign keys added after people and org table created
);

DO $$ BEGIN
    create type public.table_name as enum (
		'public.education_by_person_data',
		'public.education_entries_data',
		'public.global_role_column_grants',
		'public.global_role_memberships',
		'public.global_role_table_permissions',
		'public.global_roles_data',
		'public.locations_data',
		'public.organization_grants_data',
		'public.organization_memberships_data',
		'public.organizations_data',
		'public.people_data',
		'public.people_to_org_relationship_type_data',
		'public.people_to_org_relationships_data',
		'public.project_member_roles_data',
		'public.project_memberships_data',
		'public.project_role_column_grants_data',
		'public.project_roles_data',
		'public.projects_data',
		'public.users_data',

		'sil.language_codes',
		'sil.country_codes',
		'sil.table_of_languages',

		'sc.funding_account_data',
		'sc.field_zone_data',
		'sc.field_regions_data',
		'sc.locations_data',
		'sc.organizations_data',
		'sc.organization_locations_data',
		'sc.partners_data',
		'sc.language_goal_definitions_data',
		'sc.languages_data',
		'sc.language_locations_data',
		'sc.language_goals_data',
		'sc.known_languages_by_person_data',
		'sc.people_data',
		'sc.person_unavailabilities_data',
		'sc.directories_data',
		'sc.files_data',
		'sc.file_versions_data',
		'sc.projects_data',
		'sc.partnerships_data',
		'sc.change_to_plans_data',
		'sc.periodic_reports_data',
		'sc.posts_data',
		'sc.budgets_data',
		'sc.budget_records_data',
		'sc.project_locations_data',
		'sc.project_members_data',
		'sc.project_member_roles_data',
		'sc.language_engagements_data',
		'sc.products_data',
		'sc.product_scripture_references_data',
		'sc.internship_engagements_data',
		'sc.ceremonies_data'
	);
	EXCEPTION
	WHEN duplicate_object THEN null;
END; $$;


DO $$ BEGIN
    create type public.table_permission as enum (
		'Create',
		'Delete'
	);
	EXCEPTION
	WHEN duplicate_object THEN null;
END; $$;

create table if not exists public.global_role_column_grants(
	id serial primary key,
	access_level access_level not null,
	column_name varchar(32) not null,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by int not null default 0,
	global_role int not null,
	modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
	table_name public.table_name not null,
	unique (global_role, table_name, column_name),
    -- foreign keys added after people table created
	foreign key (global_role) references public.global_roles_data(id)
);

create table if not exists public.global_role_table_permissions(
    id serial primary key,
    created_at timestamp not null default CURRENT_TIMESTAMP,
    created_by int not null default 0,
    global_role int not null,
    modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
    table_name varchar(32) not null,
    table_permission table_permission not null,
    unique (global_role, table_name, table_permission),
-- foreign keys added after people table created
    foreign key (global_role) references public.global_roles_data(id)
);

create table if not exists public.global_role_memberships (
    id serial primary key,
	global_role int,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by int not null default 0,
	modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
	person int,
--	foreign key (created_by) references public.people_data(id), -- fk added later
	foreign key (global_role) references public.global_roles_data(id)
);

-- SCRIPTURE REFERENCE -----------------------------------------------------------------

-- todo
DO $$ BEGIN
    create type public.book_name as enum (
          'Genesis',
          'Matthew',
          'Revelation'
	);
	EXCEPTION
	WHEN duplicate_object THEN null;
END; $$;

create table if not exists public.scripture_references (
    id serial primary key,
    book_start book_name,
    book_end book_name,
    chapter_start int,
    chapter_end int,
    verse_start int,
    verse_end int,
    unique (book_start, book_end, chapter_start, chapter_end, verse_start, verse_end)
);

-- LOCATION -----------------------------------------------------------------

DO $$ BEGIN
    create type public.location_type as enum (
          'City',
          'County',
          'State',
		  'Country',
          'CrossBorderArea'
	);
	EXCEPTION
	WHEN duplicate_object THEN null;
END; $$;

create table if not exists public.locations_data (
	id serial primary key,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by int not null default 0,
	modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
	name varchar(255) unique not null,
	sensitivity sensitivity not null default 'High',
	type location_type not null
-- foreign keys added after people table created
);

-- LANGUAGE -----------------------------------------------------------------

-- sil tables are copied from SIL schema docs
-- https://www.ethnologue.com/codes/code-table-structure
-- http://www.ethnologue.com/sites/default/files/Ethnologue-19-Global%20Dataset%20Doc.pdf

create schema if not exists sil;

CREATE TABLE if not exists sil.language_codes (
   lang char(3) not null,  -- Three-letter code
   country char(2) not null,  -- Main country where used
   lang_status char(1) not null,  -- L(iving), (e)X(tinct)
   name varchar(75) not null   -- Primary name in that country
);

CREATE TABLE if not exists sil.country_codes (
   country char(2) not null,  -- Two-letter code from ISO3166
   name varchar(75) not null,  -- Country name
   area varchar(10) not null -- World area
);

CREATE TABLE if not exists sil.language_index (
   lang char(3) not null,  -- Three-letter code for language
   country char(2) not null,  -- Country where this name is used
   name_type char(2) not null,  -- L(anguage), LA(lternate),
                                -- D(ialect), DA(lternate)
                                -- LP,DP (a pejorative alternate)
   name  varchar(75) not null
);

create table if not exists sil.table_of_languages (
    id serial primary key,
    sil_ethnologue_legacy varchar(32),
	iso_639 char(3),
	created_at timestamp not null default CURRENT_TIMESTAMP,
	code varchar(32),
	language_name varchar(50) not null,
	population int,
	provisional_code varchar(32)
);

-- PEOPLE ------------------------------------------------------------

create table if not exists public.people_data (
    id serial primary key,
    about text,
    created_at timestamp not null default CURRENT_TIMESTAMP,
    created_by int default 0, -- don't make not null!
    modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int, -- don't make not null or give a default!
    phone varchar(32),
	picture varchar(255),
    primary_org int,
    private_first_name varchar(32),
    private_last_name varchar(32),
    public_first_name varchar(32),
    public_last_name varchar(32),
    primary_location int,
    private_full_name varchar(64),
    public_full_name varchar(64),
    sensitivity_clearance sensitivity default 'Low',
    time_zone varchar(32),
    title varchar(255),
    foreign key (created_by) references public.people_data(id),
    foreign key (modified_by) references public.people_data(id),
-- foreign keys added after org table created
    foreign key (primary_location) references public.locations_data(id)
);

-- fkey for a bunch of stuff
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_global_roles_created_by_fk') THEN
ALTER TABLE public.global_roles_data ADD CONSTRAINT public_global_roles_created_by_fk foreign key (created_by) references public.people_data(id);
END IF; END; $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_global_roles_modified_by_fk') THEN
ALTER TABLE public.global_roles_data ADD CONSTRAINT public_global_roles_modified_by_fk foreign key (modified_by) references people_data(id);
END IF; END; $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_global_role_grants_created_by_fk') THEN
ALTER TABLE public.global_role_column_grants ADD CONSTRAINT public_global_role_grants_created_by_fk foreign key (created_by) references public.people_data(id);
END IF; END; $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_global_role_grants_modified_by_fk') THEN
ALTER TABLE public.global_role_column_grants ADD CONSTRAINT public_global_role_grants_modified_by_fk foreign key (modified_by) references people_data(id);
END IF; END; $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_global_role_table_permissions _created_by_fk') THEN
ALTER TABLE public.global_role_table_permissions ADD CONSTRAINT public_global_role_table_permissions_created_by_fk foreign key (created_by) references public.people_data(id);
END IF; END; $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_global_role_table_permissions_modified_by_fk') THEN
ALTER TABLE public.global_role_table_permissions ADD CONSTRAINT public_global_role_table_permissions_modified_by_fk foreign key (modified_by) references people_data(id);
END IF; END; $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_global_role_memberships_person_fk') THEN
ALTER TABLE public.global_role_memberships ADD CONSTRAINT public_global_role_memberships_person_fk foreign key (person) references public.people_data(id);
END IF; END; $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_global_role_memberships_created_by_fk') THEN
ALTER TABLE public.global_role_memberships ADD CONSTRAINT public_global_role_memberships_created_by_fk foreign key (created_by) references public.people_data(id);
END IF; END; $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_global_role_memberships_modified_by_fk') THEN
ALTER TABLE public.global_role_memberships ADD CONSTRAINT public_global_role_memberships_modified_by_fk foreign key (modified_by) references people_data(id);
END IF; END; $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_locations_created_by_fk') THEN
ALTER TABLE public.locations_data ADD CONSTRAINT public_locations_created_by_fk foreign key (created_by) references public.people_data(id);
END IF; END; $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_locations_modified_by_fk') THEN
ALTER TABLE public.locations_data ADD CONSTRAINT public_locations_modified_by_fk foreign key (modified_by) references people_data(id);
END IF; END; $$;

-- Education

create table if not exists public.education_entries_data (
    id serial primary key,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by int not null,
    degree varchar(64),
    institution varchar(64),
    major varchar(64),
    modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
    foreign key (created_by) references public.people_data(id),
    foreign key (modified_by) references public.people_data(id)
);

create table if not exists public.education_by_person_data (
    id serial primary key,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by int not null default 0,
    education int not null,
    graduation_year int,
    modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
    person int not null,
    foreign key (created_by) references public.people_data(id),
    foreign key (modified_by) references public.people_data(id),
	foreign key (person) references public.people_data(id),
	foreign key (education) references public.education_entries_data(id)
);

-- ORGANIZATIONS ------------------------------------------------------------

create table if not exists public.organizations_data (
	id serial primary key,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by int not null default 0,
	modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
	name varchar(255) unique not null,
	sensitivity sensitivity default 'High',
	primary_location int,
	foreign key (created_by) references public.people_data(id),
    foreign key (modified_by) references public.people_data(id),
	foreign key (primary_location) references locations_data(id)
);


DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_global_roles_org_fk') THEN
ALTER TABLE public.global_roles_data ADD CONSTRAINT public_global_roles_org_fk foreign key (org) references organizations_data(id);
END IF; END; $$;

-- fkey for people
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'primary_org_fkey') THEN
ALTER TABLE public.people_data ADD CONSTRAINT primary_org_fkey foreign key (primary_org) references public.organizations_data(id);
END IF; END; $$;

-- fkey for global_roles
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'global_role_org_fkey') THEN
ALTER TABLE global_roles_data ADD CONSTRAINT global_role_org_fkey foreign key (org) references public.organizations_data(id);
END IF; END; $$;

DO $$ BEGIN
    create type public.person_to_org_relationship_type as enum (
          'Vendor',
          'Customer',
          'Investor',
          'Associate',
          'Employee',
          'Member',
		  'Executive',
		  'President/CEO',
          'Board of Directors',
          'Retired',
          'Other'
	);
	EXCEPTION
	WHEN duplicate_object THEN null;
END; $$;

create table if not exists public.organization_grants_data(
    id serial primary key,
    access_level access_level not null,
    created_at timestamp not null default CURRENT_TIMESTAMP,
    created_by int not null default 0,
    column_name varchar(32) not null,
    modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
    org int not null,
    table_name table_name not null,
    unique (org, table_name, column_name, access_level),
    foreign key (created_by) references public.people_data(id),
    foreign key (modified_by) references public.people_data(id),
    foreign key (org) references organizations_data(id)
);

create table if not exists public.organization_memberships_data(
    id serial primary key,
    created_at timestamp not null default CURRENT_TIMESTAMP,
    created_by int not null default 0,
    modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
    org int not null,
    person int not null,
    foreign key (created_by) references public.people_data(id),
    foreign key (modified_by) references public.people_data(id),
    foreign key (org) references organizations_data(id),
    foreign key (person) references people_data(id)
);

create table if not exists public.people_to_org_relationships_data (
    id serial primary key,
	org int,
	person int,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by int not null default 0,
	modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
	foreign key (created_by) references public.people_data(id),
    foreign key (modified_by) references public.people_data(id),
	foreign key (org) references organizations_data(id),
	foreign key (person) references people_data(id)
);

create table if not exists public.people_to_org_relationship_type_data (
    id serial primary key,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by int not null default 0,
    begin_at timestamp not null,
	end_at timestamp,
	modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
    people_to_org int,
	relationship_type person_to_org_relationship_type,
	foreign key (created_by) references public.people_data(id),
    foreign key (modified_by) references public.people_data(id),
	foreign key (people_to_org) references people_to_org_relationships_data(id)
);

-- USERS ---------------------------------------------------------------------

create table if not exists public.users_data(
    id serial primary key,
	person int not null,
	owning_org int not null,
	email varchar(255) unique not null,
	password varchar(255) not null,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by int not null default 0,
	modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
	foreign key (created_by) references public.people_data(id),
    foreign key (modified_by) references public.people_data(id),
	foreign key (person) references public.people_data(id),
	foreign key (owning_org) references public.organizations_data(id)
);

-- PROJECTS ------------------------------------------------------------------

create table if not exists public.projects_data (
	id serial primary key,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by int not null default 0,
	modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
	name varchar(32) not null,
	primary_org int,
	primary_location int,
	sensitivity sensitivity default 'High',
	unique (primary_org, name),
	foreign key (created_by) references public.people_data(id),
    foreign key (modified_by) references public.people_data(id),
	foreign key (primary_org) references organizations_data(id),
	foreign key (primary_location) references locations_data(id)
);

create table if not exists public.project_memberships_data (
    id serial primary key,
    created_at timestamp not null default CURRENT_TIMESTAMP,
    created_by int not null default 0,
    modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
    person int not null,
    project int not null,
    foreign key (created_by) references public.people_data(id),
    foreign key (modified_by) references public.people_data(id),
    foreign key (project) references projects_data(id),
    foreign key (person) references people_data(id)
);

create table if not exists public.project_roles_data (
	id serial primary key,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by int not null default 0,
	modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
	name varchar(255) not null,
	org int,
	unique (org, name),
	foreign key (created_by) references public.people_data(id),
    foreign key (modified_by) references public.people_data(id),
	foreign key (org) references public.organizations_data(id)
);

create table if not exists public.project_role_column_grants_data (
    id serial primary key,
	access_level access_level not null,
	column_name varchar(32) not null,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by int not null default 0,
	modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
	project_role int not null,
	table_name table_name not null,
	unique (project_role, table_name, column_name, access_level),
	foreign key (created_by) references public.people_data(id),
    foreign key (modified_by) references public.people_data(id),
	foreign key (project_role) references project_roles_data(id)
);

create table if not exists public.project_member_roles_data (
    id serial primary key,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by int not null default 0,
	modified_at timestamp not null default CURRENT_TIMESTAMP,
    modified_by int not null default 0,
    person int not null,
    project int not null,
	project_role int,
	unique (project, person),
	foreign key (created_by) references public.people_data(id),
    foreign key (modified_by) references public.people_data(id),
	foreign key (person) references people_data(id),
	foreign key (project) references projects_data(id),
	foreign key (project_role) references project_roles_data(id)
);

-- AUTHENTICATION ------------------------------------------------------------

create table if not exists public.tokens (
	token varchar(512) primary key,
	person int not null,
	created_at timestamp not null default CURRENT_TIMESTAMP,
	foreign key (person) references people_data(id)
);

create table if not exists public.sessions (
    session varchar(128) primary key,
    token varchar(512) not null,
    person int,
    created_at timestamp not null default CURRENT_TIMESTAMP,
    foreign key (person) references public.people_data(id),
    foreign key (token) references public.tokens(token)
);
