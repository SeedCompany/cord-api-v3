-- common schema. common_organizations_id specific schema should go in an common_organizations_id-specific file.

-- ENUMS ----

create type common.mime_type as enum (
  'application/msword',
  'application/pdf',
  'application/postscript',
  'application/rtf',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  'application/vnd.ms-outlook',
  'application/octet-stream',
  'application/vnd.ms-powerpoint',
  'application/vnd.ms-project',
  'application/vnd.oasis.opendocument.chart',
  'application/vnd.oasis.opendocument.chart-template',
  'application/vnd.oasis.opendocument.database',
  'application/vnd.oasis.opendocument.graphics',
  'application/vnd.oasis.opendocument.graphics-template',
  'application/vnd.oasis.opendocument.image',
  'application/vnd.oasis.opendocument.image-template',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.presentation-template',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.spreadsheet-template',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.text-master',
  'application/vnd.oasis.opendocument.text-template',
  'application/vnd.oasis.opendocument.text-web',

-- This is a temporal fix for application/vnd.openxmlformats-officedocument mime types
-- Since Postgres only accepts up to 63 byte chars for labels
--  'app/vnd.openxmlformats-officedocument.presentationml.presentation',
  'app/vnd.openxmlformats-officedocument.presentationml.slide',
  'app/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'app/vnd.openxmlformats-officedocument.presentationml.template',
  'app/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'app/vnd.openxmlformats-officedocument.spreadsheetml.template',
  'app/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'app/vnd.openxmlformats-officedocument.wordprocessingml.template',


  'application/vnd.visio',
  'application/vnd.wordperfect',
  'application/x-font-ghostscript',
  'application/x-font-linux-psf',
  'application/x-font-pcf',
  'application/x-font-snf',
  'application/x-font-type1',
  'application/x-gtar',
  'application/x-iso9660-image',
  'application/x-ms-wmd',
  'application/x-msaccess',
  'application/x-mspublisher',
  'application/x-mswrite',
  'application/x-tar',
  'application/x-tex',
  'application/x-tex-tfm',
  'application/x-texinfo',
  'application/x-zip-compressed',
  'application/zip',
  'audio/adpcm',
  'audio/basic',
  'audio/midi',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/s3m',
  'audio/silk',
  'audio/vnd.rip',
  'audio/webm',
  'audio/x-aac',
  'audio/x-aiff',
  'audio/x-caf',
  'audio/x-flac',
  'audio/x-matroska',
  'audio/x-mpegurl',
  'audio/x-ms-wax',
  'audio/x-ms-wma',
  'audio/xpn-realaudio',
  'audio/x-wav',
  'audio/xm',
  'font/otf',
  'font/ttf',
  'font/woff',
  'font/woff2',
  'image/bmp',
  'image/cgm',
  'image/g3fax',
  'image/gif',
  'image/ief',
  'image/jpeg',
  'image/ktx',
  'image/png',
  'image/sgi',
  'image/svg+xml',
  'image/tiff',
  'image/vnd.adobe.photoshop',
  'image/vnd.dwg',
  'image/vnd.dxf',
  'image/x-3ds',
  'image/x-cmu-raster',
  'image/x-cmx',
  'image/x-freehand',
  'image/x-icon',
  'image/x-mrsid-image',
  'image/x-pcx',
  'image/x-pict',
  'image/x-portable-anymap',
  'image/x-portable-bitmap',
  'image/x-portable-graymap',
  'image/x-portable-pixmap',
  'image/x-rgb',
  'image/x-tga',
  'image/x-xbitmap',
  'image/x-xpixmap',
  'image/xwindowdump',
  'message/rfc822',
  'text/calendar',
  'text/css',
  'text/csv',
  'text/html',
  'text/plain',
  'text/richtext',
  'text/rtf',
  'text/sgml',
  'text/tab-separated-values',
  'video/3gpp',
  'video/3gp2',
  'video/h261',
  'video/h263',
  'video/h264',
  'video/jpeg',
  'video/jpm',
  'video/mj2',
  'video/mp4',
  'video/mpeg',
  'video/ogg',
  'video/quicktime',
  'video/vnd.mpegurl',
  'video/vnd.vivo',
  'video/webm',
  'video/x-f4v',
  'video/x-fli',
  'video/x-flv',
  'video/x-m4v',
  'video/x-matroska',
  'video/x-mng',
  'video/x-ms-asf',
  'video/x-ms-vob',
  'video/x-ms-wm',
  'video/x-ms-wmv',
  'video/x-ms-wmx',
  'video/x-ms-wvx',
  'video/x-msvideo',
  'video/x-sgi-movie',
  'video/x-smv'
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

-- meant to be extended by all orgs, so everyone has a globally unique id to reference within their language_common_languages_id lists
create table common.languages(
  id varchar(32) primary key default common.nanoid(),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create table common.site_text_strings(
  id varchar(32) primary key default common.nanoid(),

  -- US English, all translations including other English locales will be in the translation table
  english varchar(64), -- unique not null
  comment text,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create table common.site_text_translations(
  id varchar(32) primary key default common.nanoid(),

  language_common_languages_id varchar(32) not null references common.languages(id),
  site_text_common_site_text_strings_id varchar(32) not null references common.site_text_strings(id) on delete cascade,
  translation varchar(64) not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

  unique (language_common_languages_id, site_text_common_site_text_strings_id)
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
  id varchar(32) primary key default common.nanoid(),

  start int, -- absolute verse
  end int,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

-- CHAT ------------------------------------------------------------

create table common.discussion_channels (
	id varchar(32) primary key default common.nanoid(),

	name varchar(32) not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),
  unique (name, owning_group_admin_groups_id)
);

create table common.cell_channels (
	id varchar(32) primary key default common.nanoid(),

  table_name admin.table_name not null,
  column_name varchar(64) not null,
  row varchar(32) not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

  unique (table_name, column_name, row)
);

create table common.threads (
	id varchar(32) primary key default common.nanoid(),

	channel_common_discussion_channels_id varchar(32) not null references common.discussion_channels(id) on delete cascade,
	content text not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create table common.posts (
	id varchar(32) primary key default common.nanoid(),
	thread_common_threads_id varchar(32) not null references common.threads(id) on delete cascade,
	content text not null,
  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

-- BLOGS ---------------

create table common.blogs (
	id varchar(32) primary key default common.nanoid(),

	title varchar(64) not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

  unique (title, owning_group_admin_groups_id)
);

create table common.blog_posts (
	id varchar(32) primary key default common.nanoid(),

  blog_common_blogs_id varchar(32) not null references common.blogs(id),
	content text not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

-- NOTES ----------------------------------------------------

create table common.notes (
	id varchar(32) primary key default common.nanoid(),

  table_name admin.table_name not null,
  column_name varchar(64) not null,
  row varchar(32) not null,
	content text not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

-- common_locations_id -----------------------------------------------------------------

create type common.location_type as enum (
  'City',
  'County',
  'State',
  'Country',
  'CrossBorderArea'
);

create table common.locations (
	id varchar(32) primary key default common.nanoid(),

	iso_3166_alpha_3 char(3), -- unique, todo research this column
	name varchar(255) unique, -- not null,
	sensitivity common.sensitivity not null default 'High', -- todo research the need for this
	type common.location_type, -- not null,

	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by_admin_people_id varchar(32) not null references admin.people(id),
	modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

ALTER TABLE admin.people ADD CONSTRAINT common_people_primary_location_fk foreign key (primary_location_common_locations_id) references common.locations(id);
ALTER TABLE common.locations ADD CONSTRAINT common_locations_created_by_fk foreign key (created_by_admin_people_id) references admin.people(id);
ALTER TABLE common.locations ADD CONSTRAINT common_locations_modified_by_fk foreign key (modified_by_admin_people_id) references admin.people(id);

create table common.language_locations (
  id varchar(32) primary key default common.nanoid(),

	language_common_languages_id varchar(32) not null references common.languages(id),
	location_common_locations_id varchar(32) not null references common.locations(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

	unique (language_common_languages_id, common_locations_id)
);
-- education_common_education_entries_id

create type common.education_degree as enum (
  'Primary',
  'Secondary',
  'Associates',
  'Bachelors',
  'Masters',
  'Doctorate'
);

create table common.education_entries (
  id varchar(32) primary key default common.nanoid(),

  degree common.education_degree,
  institution varchar(64),
  major varchar(64),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)

  -- unique (degree, institution, major)
);

create table common.education_by_person (
  id varchar(32) primary key default common.nanoid(),

  admin_people_id varchar(32) unique not null references admin.people(id),
  education_common_education_entries_id varchar(32) not null references common.education_entries(id),
  graduation_year int,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

  unique (admin_people_id, education_common_education_entries_id)
);

-- ORGANIZATIONS ------------------------------------------------------------

create table common.organizations (
	id varchar(32) primary key default common.nanoid(),

	name varchar(255), -- unique not null
	sensitivity common.sensitivity default 'High',
	primary_location_common_locations_id varchar(32) references common.locations(id),
  street_address varchar(255),
  city varchar(255),
  state varchar(32),
  nation varchar(32),
  root_directory_common_directories_id varchar(32) references common.directories(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create table common.organization_locations(
  id varchar(32) primary key default common.nanoid(),

	organization_common_organizations_id varchar(32) not null references common.organizations(id),
	location_common_locations_id varchar(32) not null references common.locations(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

	unique (organization_common_organizations_id, location_common_locations_id)
);

create table common.org_chart_positions(
  id varchar(32) primary key default common.nanoid(),

  common_organizations_id varchar(32) not null references common.organizations(id),
  name varchar(64) not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

  unique (common_organizations_id, name)
);

create type common.position_relationship_types as enum (
  'Reports To',
  'Works With'
);

create table common.org_chart_position_graph(
  id varchar(32) primary key default common.nanoid(),

  from_position_common_org_chart_positions_id varchar(32) not null references common.org_chart_positions(id),
  to_position_common_org_chart_positions_id varchar(32) not null references common.org_chart_positions(id),
  relationship_type common.position_relationship_types,
  position_start date,
  position_end date,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

  unique (from_position_common_org_chart_positions_id, to_position_common_org_chart_positions_id, relationship_type)
);

-- COALITIONS ----------------------------------------------------------

create type common.involvement_options as enum (
  'CIT',
  'Engagements'
);

create table common.coalitions(
  id varchar(32) primary key default common.nanoid(),

  name varchar(64) unique not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

-- common_coalitions_id memberships

create table common.coalition_memberships(
  id varchar(32) primary key default common.nanoid(),

  common_coalitions_id varchar(32) not null references common.coalitions(id),
  common_organizations_id varchar(32) not null references common.organizations(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

  unique (common_coalitions_id, common_organizations_id)
);

-- FILES & DIRECTORIES ----------------------------------------------------------

-- todo research cascading deletes
create table common.directories (
  id varchar(32) primary key default common.nanoid(),

  parent_common_directories_id varchar(32) references common.directories(id),
  name varchar(255), -- not null

	-- todo add triggers for derived data
	-- size
	-- total files (not directories or versions)
	-- id of first file created
	-- modified at/by of most recent file version added in any dir/sub
	-- add derived data from sub-directories/files

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create table common.files (
  id varchar(32) primary key default common.nanoid(),

  parent_common_directories_id varchar(32) references common.directories(id), --not null
	name varchar(255), -- not null

  -- todo, derived data

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create table common.file_versions (
  id varchar(32) primary key default common.nanoid(),

  mime_type varchar(255), -- not null
  name varchar(255), -- not null,
  parent_common_files_id varchar(32) references common.files(id), -- not null
  file_url varchar(255), -- not null,
  file_size int, -- bytes

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

-- TICKETS ----------------------------------------------------------------------

create type common.ticket_status as enum (
  'Open',
  'Blocked',
  'Closed'
);

create table common.tickets (
	id varchar(32) primary key default common.nanoid(),

  title varchar(64) not null,
	ticket_status common.ticket_status not null default 'Open',
	parent varchar(32),
	content text not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

ALTER TABLE common.tickets ADD CONSTRAINT common_tickets_parent_fk foreign key (parent) references common.tickets(id);

create table common.ticket_graph (
	id varchar(32) primary key default common.nanoid(),

	from_ticket_common_tickets_id varchar(32) not null references common.tickets(id),
	to_ticket_common_tickets_id varchar(32) not null references common.tickets(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create table common.ticket_assignments (
	id varchar(32) primary key default common.nanoid(),

	common_tickets_id varchar(32) not null references common.tickets(id),
	admin_people_id varchar(32)  not null references admin.people(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create table common.work_records(
	id varchar(32) primary key default common.nanoid(),

	admin_people_id varchar(32) not null references admin.people(id),
	common_tickets_id varchar(32) not null references common.tickets(id),
	hours int not null,
	minutes int default 0,
	total_time decimal generated always as (
	  hours + (minutes / 60)
	) stored,
	comment text,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create table common.work_estimates(
	id varchar(32) primary key default common.nanoid(),
  common_tickets_id varchar(32) references common.tickets(id),
	admin_people_id varchar(32) not null references admin.people(id),
	hours int not null,
	minutes int default 0,
	total_time decimal generated always as (
    hours + (minutes / 60)
  ) stored,
	comment text,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create type common.ticket_feedback_options as enum (
  'Satisfied',
  'Unsatisfied'
);

create table common.ticket_feedback(
	id varchar(32) primary key default common.nanoid(),

	common_tickets_id varchar(32) references common.tickets(id),
	stakeholder varchar(32) not null references admin.people(id),
	feedback common.ticket_feedback_options not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

-- WORKFLOW -----------------------------------------------------------------

create table common.workflows(
	id varchar(32) primary key default common.nanoid(),

	title varchar(128) not null unique,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create table common.stages(
	id varchar(32) primary key default common.nanoid(),

	title varchar(128) not null unique,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create table common.stage_graph(
	id varchar(32) primary key default common.nanoid(),

	from_stage varchar(32) not null references common.stages(id),
	to_stage varchar(32) not null references common.stages(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

  unique (from_stage, to_stage)
);

create table common.stage_role_column_grants(
	id varchar(32) primary key default common.nanoid(),

  common_stages_id varchar(32) not null references common.stages(id),
	admin_role_id varchar(32) not null references admin.roles(id),
	table_name admin.table_name not null,
	column_name varchar(64) not null,
	access_level admin.access_level not null,

	created_at timestamp not null default CURRENT_TIMESTAMP,
	created_by_admin_people_id varchar(32) not null references admin.people(id),
	modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id),

	unique (admin_role_id, table_name, column_name)
);

create table common.stage_notifications(
	id varchar(32) primary key default common.nanoid(),

	common_stages_id varchar(32) not null references common.stages(id),
	on_enter bool default false,
	on_exit bool default false,
	admin_people_id varchar(32) unique references admin.people(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
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
  id varchar(32) primary key default common.nanoid(),

	common_organizations_id varchar(32) not null references common.organizations(id),
	admin_people_id varchar(32) unique not null references admin.people(id),
	relationship_type common.people_to_org_relationship_type,
  begin_at date,
  end_at date,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create type common.people_to_people_relationship_types as enum (
  'Friend',
  'Colleague',
  'Other'
);

create table common.people_graph (
  id varchar(32) primary key default common.nanoid(),

  from_admin_people_id varchar(32) unique not null references admin.people(id),
  to_admin_people_id varchar(32) unique not null references admin.people(id),
  rel_type common.people_to_people_relationship_types not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

insert into admin_table_name_enum(value) values
  ('common_blogs'),
  ('common_blog_posts'),
  ('common_cell_channels'),
  ('common_coalition_memberships'),
  ('common_coalitions'),
  ('common_directories'),
  ('common_discussion_channels'),
  ('common_education_by_person'),
  ('common_education_entries'),
  ('common_file_versions'),
  ('common_files'),
  ('common_languages'),
  ('common_locations'),
  ('common_notes'),
  ('common_organizations'),
  ('common_org_chart_positions'),
  ('common_org_chart_position_graph'),
  ('common_people_graph'),
  ('common_people_to_org_relationships'),
  ('common_posts'),
  ('common_up.prayer_requests'),
  ('common_up.prayer_notifications'),
  ('common_scripture_references'),
  ('common_site_text_strings'),
  ('common_site_text_translations'),
  ('common_stage_graph'),
  ('common_stage_notifications'),
  ('common_stage_role_column_grants'),
  ('common_stages'),
  ('common_threads'),
  ('common_ticket_assignments'),
  ('common_ticket_feedback'),
  ('common_ticket_graph'),
  ('common_tickets'),
  ('common_work_estimates'),
  ('common_work_records'),
  ('common_workflows');
