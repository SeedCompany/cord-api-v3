-- bootstrap.data.sql

-- ensure we have person 0 to use as a default creator - todo: remove
insert into public.people_data("id") values (0) on conflict do nothing;

-- ensure we have org 0 to make other inserts in this script easier - todo: remove
insert into public.organizations_data("id", "name") values (0, 'default org') on conflict do nothing;

-- SYS LOCATIONS
insert into public.locations_data("name", "sensitivity", "type") values ('USA', 'Low', 'Country') on conflict do nothing;
insert into public.locations_data("name", "sensitivity", "type") values ('Arlington', 'High', 'City') on conflict do nothing;

-- SYS ORGANIZATIONS
insert into public.organizations_data ("name") values ('Seed Company') on conflict do nothing;
insert into public.organizations_data ("name") values ('SIL') on conflict  do nothing;
insert into public.organizations_data ("name") values ('Wycliffe USA') on conflict do nothing;

-- SYS USERS
select * from public.sys_register('devops@tsco.org', 'asdf', 'Seed Company');
select * from public.sys_register('michael_marshall@tsco.org', 'asdf', 'Seed Company');
select * from public.sys_register('sc_admin@asdf.com', 'asdf', 'Seed Company');
select * from public.sys_register('sc_project_manager@asdf.com', 'asdf', 'Seed Company');
select * from public.sys_register('sc_regional_director@asdf.com', 'asdf', 'Seed Company');
select * from public.sys_register('sc_consultant@asdf.com', 'asdf', 'Seed Company');

-- SYS ROLES
select * from public.sys_create_role('SYS ADMIN', 'Seed Company');
select * from public.sys_create_role('Admin', 'Seed Company');
select * from public.sys_create_role('Project Manager', 'Seed Company');
select * from public.sys_create_role('Regional Director', 'Seed Company');
select * from public.sys_create_role('Consultant', 'Seed Company');

-- SYS ROLE GRANTS
select * from public.sys_add_role_grant('Admin', 'Seed Company', 'public.people_data', 'public_first_name', 'Read');
select * from public.sys_add_role_grant('Admin', 'Seed Company', 'public.locations_data', 'name', 'Read');
select * from public.sys_add_role_grant('Admin', 'Seed Company', 'public.locations_data', 'created_at', 'Read');
select * from public.sys_add_role_grant('Admin', 'Seed Company', 'public.locations_data', 'sensitivity', 'Read');


-- ROLE MEMBERSHIPS
select * from public.sys_add_role_member('Admin', 'Seed Company', 'michael_marshall@tsco.org');

-- PROJECT ROLES
insert into public.project_roles_data("name", "org") values ('Project Manager', 0) on conflict do nothing;
insert into public.project_roles_data("name", "org") values ('Consultant', 0) on conflict do nothing;
insert into public.project_roles_data("name", "org") values ('Intern', 0) on conflict do nothing;

-- PROJECT ROLE GRANTS
-- todo: these have hard coded role ids, which we have to use until we have functions to add project roles.
--insert into public.project_role_column_grants("access_level", "column_name", "project_role", "table_name") values ('Write', 'name', 1, 'public.projects_data') on conflict do nothing;
--insert into public.project_role_column_grants("access_level", "column_name", "project_role", "table_name") values ('Read', 'name', 2, 'public.projects_data') on conflict do nothing;

-- PROJECTS
insert into public.projects_data("name") values ('proj 1') on conflict do nothing;
insert into public.projects_data("name") values ('proj 2') on conflict do nothing;
insert into public.projects_data("name") values ('proj 3') on conflict do nothing;

-- PROJECT MEMBERSHIP
-- todo: replace with functions
insert into public.project_memberships("person", "project") values (1,1) on conflict do nothing;
--insert into public.project_memberships("person", "project") values (2,1) on conflict do nothing;

-- PROJECT ROLE MEMBERSHIPS
-- todo: need to use functions to avoid hard coded ids
insert into public.project_member_roles_data("person", "project", "project_role") values (1, 1, 1) on conflict do nothing;
insert into public.project_member_roles_data("person", "project", "project_role") values (2, 1, 1) on conflict do nothing;

insert into public.project_role_column_grants("access_level","column_name", "project_role", "table_name")
values('Write', 'name', 1, 'public.locations_data' );
select * from public.locations_security;
--insert into public.project_member_roles_data("person", "project", "project_role") values (2, 1, 1) on conflict do nothing;
--insert into public.project_member_roles_data("person", "project", "project_role") values (3, 1, 1) on conflict do nothing;
--insert into public.project_member_roles_data("person", "project", "project_role") values (4, 1, 1) on conflict do nothing;
