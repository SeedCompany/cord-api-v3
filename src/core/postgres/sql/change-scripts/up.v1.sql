-- PRAYER --------------------------------------------------------------
create schema if not exists up;

create type up.prayer_type as enum (
  'Request',
  'Update',
  'Celebration'
);

create table up.prayer_requests(
	id uuid primary key default common.uuid_generate_v4(),

  request_language_id uuid references common.languages(id),
  target_language_id uuid references common.languages(id),
  sensitivity common.sensitivity default 'High',
  organization_name varchar(64),
  parent uuid references up.prayer_requests(id),
  translator uuid references admin.people(id),
  location varchar(64),
  title varchar(64) not null,
  content text not null,
  reviewed bool default false,
  prayer_type up.prayer_type default 'Request',

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);

create table up.prayer_notifications(
	id uuid primary key default common.uuid_generate_v4(),

  request uuid references up.prayer_requests(id),
  person uuid unique references admin.people(id),

  created_at timestamp not null default CURRENT_TIMESTAMP,
  created_by_admin_people_id uuid not null references admin.people(id),
  modified_at timestamp not null default CURRENT_TIMESTAMP,
  modified_by uuid not null references admin.people(id),
  owning_person uuid not null references admin.people(id),
  owning_group uuid not null references admin.groups(id)
);
