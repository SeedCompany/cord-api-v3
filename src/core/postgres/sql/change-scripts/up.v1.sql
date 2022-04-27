-- PRAYER --------------------------------------------------------------
create schema if not exists up;

create type up.prayer_type as enum (
  'Request',
  'Update',
  'Celebration'
);

create table up.prayer_requests(
	id varchar(32) primary key default common.nanoid(),

  request_common_languages_id varchar(32) references common.languages(id),
  target_common_languages_id varchar(32) references common.languages(id),
  sensitivity common.sensitivity default 'High',
  organization_name varchar(64),
  parent_up_prayer_requests_id varchar(32) references up.prayer_requests(id),
  translator_admin_people_id varchar(32) references admin.people(id),
  common_locations_id varchar(64),
  title varchar(64) not null,
  content text not null,
  reviewed bool default false,
  prayer_type up.prayer_type default 'Request',

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);

create table up.prayer_notifications(
	id varchar(32) primary key default common.nanoid(),

  request_up_prayer_requests_id varchar(32) references up.prayer_requests(id),
  admin_people_id varchar(32) unique references admin.people(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id varchar(32) not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by_admin_people_id varchar(32) not null references admin.people(id),
  owning_person_admin_people_id varchar(32) not null references admin.people(id),
  owning_group_admin_groups_id varchar(32) not null references admin.groups(id)
);
