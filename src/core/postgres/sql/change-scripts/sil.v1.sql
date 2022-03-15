-- sil tables are copied from SIL schema docs and adorned with columns this system needs
-- https://www.ethnologue.com/codes/code-table-structure
-- http://www.ethnologue.com/sites/default/files/Ethnologue-19-Global%20Dataset%20Doc.pdf

create schema sil;

create type sil.lang_status_type as enum (
  'L', -- L(iving)
  'X' -- (e)X(tinct)
);

CREATE TABLE sil.language_codes (
  id uuid primary key default common.uuid_generate_v4(),

  lang char(3) not null,  -- Three-letter code
  country char(2) not null,  -- Main country where used
  lang_status sil.lang_status_type not null,
  name varchar(75) not null,   -- Primary name in that country

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

CREATE TABLE sil.country_codes (
  id uuid primary key default common.uuid_generate_v4(),

  country char(2) not null,  -- Two-letter code from ISO3166
  name varchar(75) not null,  -- Country name
  area varchar(10) not null, -- World area

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create type sil.language_name_type as enum (
  'L', -- L(anguage)
  'LA', -- LA(lternate)
  'D', -- D(ialect)
  'DA', -- DA(lternate)
  'LP', -- LP (a pejorative alternate)
  'DP' -- DP (a pejorative alternate)
);

CREATE TABLE sil.language_index (
  id uuid primary key not null references common.languages(id),

  lang char(3) not null,      -- Three-letter code for language_common_languages_id
  country char(2) not null,   -- Country where this name is used
  name_type sil.language_name_type not null,
  name  varchar(75) not null,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create type sil.iso_639_3_scope_options as enum (
  'I', -- Individual
  'M', -- Macrolanguage
  'S' -- Special
);

create type sil.iso_639_3_type_options as enum (
  'A', -- Ancient
  'C', -- Constructed
  'E', -- Extinct
  'H', -- Historical
  'L', -- Living
  'S' -- Special
);

CREATE TABLE sil.iso_639_3 (
  id uuid primary key default common.uuid_generate_v4(),

  _id char(3) not null, -- three letter 639-3 identifier
  part_2b char(3), -- equivalent 639-2 identifier of the bibliographic applications code set, if there is one
  part_2t char(3), -- equivalent 639-2 identifier of the terminology applications code set, if there is one
  part_1 char(2), -- equivalent 639-1 identifier, if there is one
  scope sil.iso_639_3_scope_options not null,
  type sil.iso_639_3_type_options not null,
  ref_name varchar(150) not null, -- reference language_common_languages_id name
  comment varchar(150), -- comment relating to one or more of the columns

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

CREATE TABLE sil.iso_639_3_names (
  id uuid primary key default common.uuid_generate_v4(),

  _id char(3) not null, -- three letter 639-3 identifier
  print_name varchar(75) not null, -- one of the names associated with this identifier
  inverted_name varchar(75) not null, -- the inverted form of this print_name form

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create type sil.iso_639_3_status_options as enum (
  'A', -- Active
  'R' -- Retired
);

CREATE TABLE sil.iso_639_3_macrolanguages (
  id uuid primary key default common.uuid_generate_v4(),

  m_id char(3) not null, -- the identifier for a macrolanguage
  i_id char(3) not null, -- the identifier for an individual language_common_languages_id that is a member of the macrolanguage
  i_status sil.iso_639_3_status_options not null, -- indicating the status of the individual code element

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create type sil.iso_639_3_retirement_reason_options as enum (
  'C', -- Change
  'D', -- Duplicate
  'N', -- Non-existent
  'S', -- Split
  'M' -- Merge
);

CREATE TABLE sil.iso_639_3_retirements (
  id uuid primary key default common.uuid_generate_v4(),

  _id char(3) not null, -- three letter 639-3 identifier
  ref_name varchar(150) not null, -- reference name of the language_common_languages_id
  ret_reason sil.iso_639_3_retirement_reason_options, -- code for retirement
  change_to char(3), -- in the cases of C, D, and M, the identifier to which all instances of this id should be changed
  ret_remedy varchar(300), -- the instructions for updating an instance of the retired (split) identifier
  effective timestamp not null, -- the date the retirement became effective

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

CREATE TABLE sil.table_of_countries (
  id uuid primary key default common.uuid_generate_v4(),

  country_code char(2),
  country_name varchar(40),
  languages int,
  indigenous int,
  established int,
  unestablished int,
  diversity decimal,
  included int,
  sum_of_populations int,
  mean int,
  median int,
  population int,
  literacy_rate decimal,
  conventions int,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

CREATE TABLE sil.table_of_languages (
  id uuid primary key default common.uuid_generate_v4(),

  iso_639 char(3),
  language_name varchar(50),
  uninverted_name varchar(50),
  country_code char(2),
  country_name varchar(40),
  region_code char(3),
  region_name varchar(30),
  area varchar(8),
  l1_users int,
  digits int,
  all_users int,
  countries int,
  family varchar(30),
  classification varchar(250),
  latitude decimal,
  longitude decimal,
  egids varchar(3),
  is_written char(1),
  institutional int,
  developing int,
  vigorous int,
  in_trouble int,
  dying int,
  extinct int,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

CREATE TABLE sil.table_of_languages_in_country (
  id uuid primary key default common.uuid_generate_v4(),

  iso_639 char(3),
  language_name varchar(50),
  uninverted_name varchar(50),
  country_code char(2),
  country_name varchar(40),
  region_code char(3),
  region_name varchar(30),
  area varchar(8),
  is_primary char(1),
  is_indigenous char(1),
  is_established char(1),
  all_users int,
  l1_users int,
  l2_users int,
  family varchar(30),
  egids varchar(3),
  function_code varchar(3),
  function_label varchar(42),
  institutional int,
  developing int,
  vigorous int,
  in_trouble int,
  dying int,
  extinct int,

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

-- todo Ken to give additional SIL tables
