-- common schema. org specific schema should go in an org-specific file.

-- ENUMS ----

-- todo
create type common.mime_type as enum (
  'A',
  'B',
  'C'
);

-- SITE TEXT --------------------------------------------------------------------------------

create type common.egids_scale as enum (
		'0',
		'1',
		'2',
		'3',
		'4',
		'5',
		'6a',
		'6b',
		'7',
		'8a',
		'8b',
		'9',
		'10'
);

-- meant to be extended by all orgs, so everyone has a globally unique id to reference within their language lists
create table common.languages(
  id uuid primary key default common.uuid_generate_v4(),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

create table common.site_text_strings(
  id uuid primary key default common.uuid_generate_v4(),

  english varchar(64) not null, -- US English, all translations including other English locales will be in the translation table
  comment text,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

create table common.site_text_translations(
  id uuid primary key default common.uuid_generate_v4(),

  language uuid not null references common.languages(id),
  site_text uuid not null references common.site_text_strings(id) on delete cascade,
  translation varchar(64) not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id),

  unique (language, site_text)
);

create table common.site_text_languages(
  id uuid primary key default common.uuid_generate_v4(),

  language uuid not null references common.languages(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

-- SCRIPTURE REFERENCE -----------------------------------------------------------------

-- todo
create type common.book_name as enum (
  'Genesis',
  'Exodus',
  'Leviticus',
  'Numbers',
  'Deuteronomy',
  'Joshua',
  'Judges',
  'Ruth',
  '1 Samuel',
  '2 Samuel',
  '1 Kings',
  '2 Kings',
  '1 Chronicles',
  '2 Chronicles',
  'Ezra',
  'Nehemiah',
  'Esther',
  'Job',
  'Psalms',
  'Proverbs',
  'Ecclesiastes',
  'The Song of Solomon',
  'Isaiah',
  'Jeremiah',
  'Lamentations',
  'Ezekiel',
  'Daniel',
  'Hosea',
  'Joel',
  'Amos',
  'Obadiah',
  'Jonah',
  'Micah',
  'Nahum',
  'Habakkuk',
  'Zephaniah',
  'Haggai',
  'Zechariah',
  'Malachi',
  'Matthew',
  'Mark',
  'Luke',
  'John',
  'Acts',
  'Romans',
  '1 Corinthians',
  '2 Corinthians',
  'Galatians',
  'Ephesians',
  'Philippians',
  'Colossians',
  '1 Thessalonians',
  '2 Thessalonians',
  '1 Timothy',
  '2 Timothy',
  'Titus',
  'Philemon',
  'Hebrews',
  'James',
  '1 Peter',
  '2 Peter',
  '1 John',
  '2 John',
  '3 John',
  'Jude',
  'Revelation'
);

create table common.scripture_references (
  id uuid primary key default common.uuid_generate_v4(),

  start int, -- absolute verse
  end int,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

-- CHAT ------------------------------------------------------------

create table common.discussion_channels (
	id uuid primary key default common.uuid_generate_v4(),

	name varchar(32) not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id),
  unique (name, owning_group)
);

create table common.cell_channels (
	id uuid primary key default common.uuid_generate_v4(),

  table_name admin.table_name not null,
  column_name varchar(64) not null,
  row uuid not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id),

  unique (table_name, column_name, row)
);

create table common.threads (
	id uuid primary key default common.uuid_generate_v4(),

	channel uuid not null references common.discussion_channels(id) on delete cascade,
	content text not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

create table common.posts (
	id uuid primary key default common.uuid_generate_v4(),
	thread uuid not null references common.threads(id) on delete cascade,
	content text not null,
  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

-- BLOGS ---------------

create table common.blogs (
	id uuid primary key default common.uuid_generate_v4(),

	title varchar(64) not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id),

  unique (title, owning_group)
);

create table common.blog_posts (
	id uuid primary key default common.uuid_generate_v4(),

  blog uuid not null references common.blogs(id),
	content text not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

-- NOTES ----------------------------------------------------

create table common.notes (
	id uuid primary key default common.uuid_generate_v4(),

  table_name admin.table_name not null,
  column_name varchar(64) not null,
  row uuid not null,
	content text not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

-- LOCATION -----------------------------------------------------------------

create type common.location_type as enum (
  'City',
  'County',
  'State',
  'Country',
  'CrossBorderArea'
);

create table common.locations (
	id uuid primary key default common.uuid_generate_v4(),

	iso_3166_alpha_3 char(3) unique, -- todo research this column
	name varchar(255) unique, -- not null,
	sensitivity common.sensitivity not null default 'High', -- todo research the need for this
	type common.location_type, -- not null,

	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by_admin_people_id uuid not null references admin.people(id),
	modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

ALTER TABLE admin.people ADD CONSTRAINT common_people_primary_location_fk foreign key (primary_location) references common.locations(id);
ALTER TABLE common.locations ADD CONSTRAINT common_locations_created_by_fk foreign key (created_by_admin_people_id) references admin.people(id);
ALTER TABLE common.locations ADD CONSTRAINT common_locations_modified_by_fk foreign key (modified_by) references admin.people(id);

create table common.language_locations (
  id uuid primary key default common.uuid_generate_v4(),

	language_common_languages_id uuid not null references common.languages(id),
	location_common_locations_id uuid not null references common.locations(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id),

	unique (language, location)
);
-- Education

create table common.education_entries (
  id uuid primary key default common.uuid_generate_v4(),

  degree varchar(64),
  institution varchar(64),
  major varchar(64),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id),

  unique (degree, institution, major)
);

create table common.education_by_person (
  id uuid primary key default common.uuid_generate_v4(),

  person uuid unique not null references admin.people(id),
  education uuid not null references common.education_entries(id),
  graduation_year int,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id),

  unique (person, education)
);

-- ORGANIZATIONS ------------------------------------------------------------

create table common.organizations (
	id uuid primary key default common.uuid_generate_v4(),

	name varchar(255) unique, -- not null
	sensitivity common.sensitivity default 'High',
	primary_location uuid references common.locations(id),
  street_address varchar(255),
  city varchar(255),
  state varchar(32),
  nation varchar(32),
  root_directory uuid references common.directories(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

create table common.organization_locations(
  id uuid primary key default common.uuid_generate_v4(),

	organization_common_organizations_id uuid not null references sc.organizations(id),
	location_common_locations_id uuid not null references sc.locations(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id),

	unique (organization_common_organizations_id, location_common_locations_id)
);

create table common.org_chart_positions(
  id uuid primary key default common.uuid_generate_v4(),

  organization uuid not null references common.organizations(id),
  name varchar(64) not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id),

  unique (organization, name)
);

create type common.position_relationship_types as enum (
  'Reports To',
  'Works With'
);

create table common.org_chart_position_graph(
  id uuid primary key default common.uuid_generate_v4(),

  from_position uuid not null references common.org_chart_positions(id),
  to_position uuid not null references common.org_chart_positions(id),
  relationship_type common.position_relationship_types,
  position_start date,
  position_end date,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id),

  unique (from_position, to_position, relationship_type)
);

-- COALITIONS ----------------------------------------------------------

create type common.involvement_options as enum (
  'CIT',
  'Engagements'
);

create table common.coalitions(
  id uuid primary key default common.uuid_generate_v4(),

  name varchar(64) unique not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

-- coalition memberships

create table common.coalition_memberships(
  id uuid primary key default common.uuid_generate_v4(),

  coalition uuid not null references common.coalitions(id),
  organization uuid not null references common.organizations(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id),

  unique (coalition, organization)
);

-- FILES & DIRECTORIES ----------------------------------------------------------

-- todo research cascading deletes
create table common.directories (
  id uuid primary key default common.uuid_generate_v4(),

  parent_directories_id uuid references common.directories(id),
  name varchar(255), -- not null

	-- todo add triggers for derived data
	-- size
	-- total files (not directories or versions)
	-- id of first file created
	-- modified at/by of most recent file version added in any dir/sub
	-- add derived data from sub-directories/files

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

create table common.files (
  id uuid primary key default common.uuid_generate_v4(),

  parent_directories_id uuid references common.directories(id), --not null
	name varchar(255), -- not null

  -- todo, derived data

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

create table common.file_versions (
  id uuid primary key default common.uuid_generate_v4(),

  mime_type varchar(96), -- not null, todo: common.mime_type filled in, but neo4j just has a dumb 'ole string
  name varchar(255), -- not null,
  parent_files_id uuid references common.files(id), -- not null
  file_size int, -- bytes

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

-- TICKETS ----------------------------------------------------------------------

create type common.ticket_status as enum (
  'Open',
  'Blocked',
  'Closed'
);

create table common.tickets (
	id uuid primary key default common.uuid_generate_v4(),

  title text not null,
	ticket_status common.ticket_status not null default 'Open',
	parent uuid,
	content text not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

ALTER TABLE common.tickets ADD CONSTRAINT common_tickets_parent_fk foreign key (parent) references common.tickets(id);

create table common.ticket_graph (
	id uuid primary key default common.uuid_generate_v4(),

	from_ticket uuid not null references common.tickets(id),
	to_ticket uuid not null references common.tickets(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

create table common.ticket_assignments (
	id uuid primary key default common.uuid_generate_v4(),

	ticket uuid not null references common.tickets(id),
	person uuid unique not null references admin.people(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

create table common.work_records(
	id uuid primary key default common.uuid_generate_v4(),

	person uuid not null references admin.people(id),
	ticket uuid not null references common.tickets(id),
	hours int not null,
	minutes int default 0,
	total_time decimal generated always as (
	  hours + (minutes / 60)
	) stored,
	comment text,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

create table common.work_estimates(
	id uuid primary key default common.uuid_generate_v4(),
    ticket uuid references common.tickets(id),
	person uuid not null references admin.people(id),
	hours int not null,
	minutes int default 0,
	total_time decimal generated always as (
    hours + (minutes / 60)
  ) stored,
	comment text,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

create type common.ticket_feedback_options as enum (
  'Satisfied',
  'Unsatisfied'
);

create table common.ticket_feedback(
	id uuid primary key default common.uuid_generate_v4(),

	ticket uuid references common.tickets(id),
	stakeholder uuid not null references admin.people(id),
	feedback common.ticket_feedback_options not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

-- WORKFLOW -----------------------------------------------------------------

create table common.workflows(
	id uuid primary key default common.uuid_generate_v4(),

	title varchar(128) not null unique,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

create table common.stages(
	id uuid primary key default common.uuid_generate_v4(),

	title varchar(128) not null unique,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

create table common.stage_graph(
	id uuid primary key default common.uuid_generate_v4(),

	from_stage uuid not null references common.stages(id),
	to_stage uuid not null references common.stages(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id),

  unique (from_stage, to_stage)
);

create table common.stage_role_column_grants(
	id uuid primary key default common.uuid_generate_v4(),

  stage uuid not null references common.stages(id),
	role uuid not null references admin.roles(id),
	table_name admin.table_name not null,
	column_name varchar(64) not null,
	access_level admin.access_level not null,

	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by_admin_people_id uuid not null references admin.people(id),
	modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id),

	unique (role, table_name, column_name)
);

create table common.stage_notifications(
	id uuid primary key default common.uuid_generate_v4(),

	stage uuid not null references common.stages(id),
	on_enter bool default false,
	on_exit bool default false,
	person uuid unique references admin.people(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

-- SOCIAL GRAPH ----------------------------------------------------

create type common.people_to_org_relationship_type as enum (
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

create table common.people_to_org_relationships (
  id uuid primary key default common.uuid_generate_v4(),

	org uuid not null references common.organizations(id),
	person uuid unique not null references admin.people(id),
	relationship_type common.people_to_org_relationship_type,
  begin_at date,
  end_at date,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

create type common.people_to_people_relationship_types as enum (
  'Friend',
  'Colleague',
  'Other'
);

create table common.people_graph (
  id uuid primary key default common.uuid_generate_v4(),

  from_person uuid unique not null references admin.people(id),
  to_person uuid unique not null references admin.people(id),
  rel_type common.people_to_people_relationship_types not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);
