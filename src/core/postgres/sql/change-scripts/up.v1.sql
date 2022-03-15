-- PRAYER --------------------------------------------------------------
create schema if not exists up;

create type up.prayer_type as enum (
  'Request',
  'Update',
  'Celebration'
);

create table up.prayer_requests(
	id uuid primary key default common.uuid_generate_v4(),

  request_common_languages_id uuid references common.languages(id),
  target_common_languages_id uuid references common.languages(id),
  sensitivity common.sensitivity default 'High',
  organization_name varchar(64),
  parent_up_prayer_requests_id uuid references up.prayer_requests(id),
  translator_admin_people_id uuid references admin.people(id),
  common_locations_id varchar(64),
  title varchar(64) not null,
  content text not null,
  reviewed bool default false,
  prayer_type up.prayer_type default 'Request',

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);

create table up.prayer_notifications(
	id uuid primary key default common.uuid_generate_v4(),

  request_up_prayer_requests_id uuid references up.prayer_requests(id),
  admin_people_id uuid unique references admin.people(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id uuid not null references admin.people(id),
  owning_person_admin_people_id uuid not null references admin.people(id),
  owning_group_admin_groups_id uuid not null references admin.groups(id)
);
