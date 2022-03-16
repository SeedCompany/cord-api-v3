CREATE OR REPLACE PROCEDURE admin.roles_migration(
)
LANGUAGE PLPGSQL
AS $$
DECLARE
  vProjectManagerRoleId varchar(32);
  vProjectManagersGroupId varchar(32);
  vRegionalDirectorRoleId varchar(32);
  vRegionalDirectorsGroupId varchar(32);
  vFieldOperationsDirectorRoleId varchar(32);
  vFieldOperationsDirectorsGroupId varchar(32);
  vControllerRoleId varchar(32);
  vControllersGroupId varchar(32);
  vLeadFinancialAnalystRoleId varchar(32);
  vLeadFinancialAnalystsGroupId varchar(32);
  vRoleCount int;
BEGIN
  -- create roles and groups to replicate the cord field permissions
  -- use bootstrap.sql for examples

  -- get admin person id, this will be needed when using UUIDs
  select admin.people.id 				from admin.people
  inner join admin.role_memberships 	on admin.role_memberships.person = admin.people.id
  inner join admin.roles 				on admin.role_memberships.role = admin.roles.id
  where admin.roles.name = 'Administrator'
  order by admin.people.created_at asc
  limit 1
  into vAdminPersonId;

  -- roles
  insert into admin.roles(name, created_by, modified_by, owning_person, owning_group) values ('Project Manager', 1, 1, 1, 1) returning id into vProjectManagerRoleId;
  insert into admin.roles(name, created_by, modified_by, owning_person, owning_group) values ('Regional Director', 1, 1, 1, 1) returning id into vRegionalDirectorRoleId;
  insert into admin.roles(name, created_by, modified_by, owning_person, owning_group) values ('Field Operations Director', 1, 1, 1, 1) returning id into vFieldOperationsDirectorRoleId;
  insert into admin.roles(name, created_by, modified_by, owning_person, owning_group) values ('Controller', 1, 1, 1, 1) returning id into vControllerRoleId;
  insert into admin.roles(name, created_by, modified_by, owning_person, owning_group) values ('Lead Financial Analyst', 1, 1, 1, 1) returning id into vLeadFinancialAnalystRoleId;

  -- groups
  insert into admin.groups(name, created_by, modified_by, owning_person, owning_group) values ('Project Managers', 1, 1, 1, 1) returning id into vProjectManagersGroupId;
  insert into admin.groups(name, created_by, modified_by, owning_person, owning_group) values ('Regional Director', 1, 1, 1, 1) returning id into vRegionalDirectorsGroupId;
  insert into admin.groups(name, created_by, modified_by, owning_person, owning_group) values ('Field Operations Director', 1, 1, 1, 1) returning id into vFieldOperationsDirectorsGroupId;
  insert into admin.groups(name, created_by, modified_by, owning_person, owning_group) values ('Controller', 1, 1, 1, 1) returning id into vControllersGroupId;
  insert into admin.groups(name, created_by, modified_by, owning_person, owning_group) values ('Lead Financial Analyst', 1, 1, 1, 1) returning id into vLeadFinancialAnalystsGroupId;

  -- table grants
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vProjectManagerRoleId, 'Create', 'admin.people', 1, 1, 1, 1), (vProjectManagerRoleId, 'Delete', 'admin.people', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vProjectManagerRoleId, 'Create', 'admin.users', 1, 1, 1, 1), (vProjectManagerRoleId, 'Delete', 'admin.users', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vProjectManagerRoleId, 'Create', 'common.organizations', 1, 1, 1, 1), (vProjectManagerRoleId, 'Delete', 'common.organizations', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vProjectManagerRoleId, 'Create', 'sc.languages', 1, 1, 1, 1), (vProjectManagerRoleId, 'Delete', 'sc.languages', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vRegionalDirectorRoleId, 'Create', 'admin.people', 1, 1, 1, 1), (vRegionalDirectorRoleId, 'Delete', 'admin.people', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vRegionalDirectorRoleId, 'Create', 'admin.users', 1, 1, 1, 1), (vRegionalDirectorRoleId, 'Delete', 'admin.users', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vRegionalDirectorRoleId, 'Create', 'common.organizations', 1, 1, 1, 1), (vRegionalDirectorRoleId, 'Delete', 'common.organizations', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vRegionalDirectorRoleId, 'Create', 'sc.languages', 1, 1, 1, 1), (vRegionalDirectorRoleId, 'Delete', 'sc.languages', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vFieldOperationsDirectorRoleId, 'Create', 'admin.people', 1, 1, 1, 1), (vFieldOperationsDirectorRoleId, 'Delete', 'admin.people', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vFieldOperationsDirectorRoleId, 'Create', 'admin.users', 1, 1, 1, 1), (vFieldOperationsDirectorRoleId, 'Delete', 'admin.users', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vFieldOperationsDirectorRoleId, 'Create', 'common.organizations', 1, 1, 1, 1), (vFieldOperationsDirectorRoleId, 'Delete', 'common.organizations', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vFieldOperationsDirectorRoleId, 'Create', 'sc.languages', 1, 1, 1, 1), (vFieldOperationsDirectorRoleId, 'Delete', 'sc.languages', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vControllerRoleId, 'Create', 'admin.people', 1, 1, 1, 1), (vControllerRoleId, 'Delete', 'admin.people', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vControllerRoleId, 'Create', 'admin.users', 1, 1, 1, 1), (vControllerRoleId, 'Delete', 'admin.users', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vControllerRoleId, 'Create', 'common.organizations', 1, 1, 1, 1), (vControllerRoleId, 'Delete', 'common.organizations', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vControllerRoleId, 'Create', 'sc.languages', 1, 1, 1, 1), (vControllerRoleId, 'Delete', 'sc.languages', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vLeadFinancialAnalystRoleId, 'Create', 'admin.people', 1, 1, 1, 1), (vLeadFinancialAnalystRoleId, 'Delete', 'admin.people', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vLeadFinancialAnalystRoleId, 'Create', 'admin.users', 1, 1, 1, 1), (vLeadFinancialAnalystRoleId, 'Delete', 'admin.users', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vLeadFinancialAnalystRoleId, 'Create', 'common.organizations', 1, 1, 1, 1), (vLeadFinancialAnalystRoleId, 'Delete', 'common.organizations', 1, 1, 1, 1);
  insert into admin.role_table_permissions(role, table_permission, table_name, created_by, modified_by, owning_person, owning_group) values (vLeadFinancialAnalystRoleId, 'Create', 'sc.languages', 1, 1, 1, 1), (vLeadFinancialAnalystRoleId, 'Delete', 'sc.languages', 1, 1, 1, 1);

  -- column grants

  -- people's table
  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'id', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'neo4j', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'about', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'created_at', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'created_by', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'modified_at', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'modified_by', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'phone', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'picture', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'primary_org', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_first_name', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_last_name', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_first_name', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_last_name', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'primary_location', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_full_name', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_full_name', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'sensitivity_clearance', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'time_zone', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'title', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'status', vProjectManagerRoleId, 'admin.people', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'id', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'neo4j', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'about', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'created_at', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'created_by', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'modified_at', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'modified_by', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'phone', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'picture', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'primary_org', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_first_name', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_last_name', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_first_name', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_last_name', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'primary_location', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_full_name', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_full_name', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'sensitivity_clearance', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'time_zone', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'title', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'status', vRegionalDirectorRoleId, 'admin.people', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'id', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'neo4j', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'about', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'created_at', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'created_by', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'modified_at', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'modified_by', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'phone', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'picture', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'primary_org', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_first_name', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_last_name', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_first_name', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_last_name', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'primary_location', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_full_name', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_full_name', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'sensitivity_clearance', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'time_zone', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'title', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'status', vFieldOperationsDirectorRoleId, 'admin.people', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'id', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'neo4j', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'about', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'created_at', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'created_by', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'modified_at', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'modified_by', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'phone', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'picture', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'primary_org', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_first_name', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_last_name', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_first_name', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_last_name', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'primary_location', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_full_name', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_full_name', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'sensitivity_clearance', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'time_zone', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'title', vControllerRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'status', vControllerRoleId, 'admin.people', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'id', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'neo4j', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'about', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'created_at', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'created_by', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'modified_at', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'modified_by', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'phone', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'picture', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'primary_org', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_first_name', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_last_name', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_first_name', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_last_name', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'primary_location', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'private_full_name', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'public_full_name', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'sensitivity_clearance', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'time_zone', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'title', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1),
  ('Write', 'status', vLeadFinancialAnalystRoleId, 'admin.people', 1, 1, 1, 1);

  -- grants on users
  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'id', vProjectManagerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'person', vProjectManagerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'owning_org', vProjectManagerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'email', vProjectManagerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'password', vProjectManagerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'created_at', vProjectManagerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'created_by', vProjectManagerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'modified_at', vProjectManagerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'modified_by', vProjectManagerRoleId, 'admin.users', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'id', vRegionalDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'person', vRegionalDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'owning_org', vRegionalDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'email', vRegionalDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'password', vRegionalDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'created_at', vRegionalDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'created_by', vRegionalDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'modified_at', vRegionalDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'modified_by', vRegionalDirectorRoleId, 'admin.users', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'id', vFieldOperationsDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'person', vFieldOperationsDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'owning_org', vFieldOperationsDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'email', vFieldOperationsDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'password', vFieldOperationsDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'created_at', vFieldOperationsDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'created_by', vFieldOperationsDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'modified_at', vFieldOperationsDirectorRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'modified_by', vFieldOperationsDirectorRoleId, 'admin.users', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'id', vControllerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'person', vControllerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'owning_org', vControllerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'email', vControllerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'password', vControllerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'created_at', vControllerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'created_by', vControllerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'modified_at', vControllerRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'modified_by', vControllerRoleId, 'admin.users', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'id', vLeadFinancialAnalystRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'person', vLeadFinancialAnalystRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'owning_org', vLeadFinancialAnalystRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'email', vLeadFinancialAnalystRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'password', vLeadFinancialAnalystRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'created_at', vLeadFinancialAnalystRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'created_by', vLeadFinancialAnalystRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'modified_at', vLeadFinancialAnalystRoleId, 'admin.users', 1, 1, 1, 1),
  ('Write', 'modified_by', vLeadFinancialAnalystRoleId, 'admin.users', 1, 1, 1, 1);

  -- grants on sc.languages
  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'id', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'prioritization', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'progress_bible', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'location_long', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'island', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'province', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'first_language_population', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'population_value', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'egids_level', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'egids_value', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'least_reached_progress_jps_level', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'least_reached_value', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'partner_interest_level', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_value', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_description', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_source', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'multiple_languages_leverage_linguistic_level', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_value', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_description', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_source', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'multiple_languages_leverage_joint_training_level', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_value', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_description', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_source', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'lang_comm_int_in_language_development_level', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_value', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_description', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_source', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'lang_comm_int_in_scripture_translation_level', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_value', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_description', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_source', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'access_to_scripture_in_lwc_level', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_value', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_description', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_source', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'begin_work_geo_challenges_level', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_value', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_description', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_source', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'begin_work_rel_pol_obstacles_level', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_value', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_description', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_source', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
   values ('Write', 'suggested_strategies', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1);
  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'comments', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'created_at', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'created_by', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'modified_at', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'modified_by', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'owning_person', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'owning_group', vProjectManagerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'id', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'prioritization', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'progress_bible', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'location_long', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'island', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'province', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'first_language_population', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'population_value', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'egids_level', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'egids_value', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'least_reached_progress_jps_level', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'least_reached_value', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'partner_interest_level', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_value', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_description', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_source', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'multiple_languages_leverage_linguistic_level', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_value', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_description', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_source', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'multiple_languages_leverage_joint_training_level', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_value', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_description', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_source', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'lang_comm_int_in_language_development_level', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_value', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_description', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_source', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'lang_comm_int_in_scripture_translation_level', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_value', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_description', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_source', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'access_to_scripture_in_lwc_level', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_value', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_description', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_source', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'begin_work_geo_challenges_level', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_value', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_description', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_source', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'begin_work_rel_pol_obstacles_level', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_value', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_description', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_source', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'suggested_strategies', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1);
  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'comments', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'created_at', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'created_by', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'modified_at', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'modified_by', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'owning_person', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'owning_group', vRegionalDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'id', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'prioritization', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'progress_bible', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'location_long', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'island', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'province', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'first_language_population', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'population_value', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'egids_level', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'egids_value', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'least_reached_progress_jps_level', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'least_reached_value', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'partner_interest_level', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_value', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_description', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_source', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'multiple_languages_leverage_linguistic_level', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_value', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_description', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_source', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'multiple_languages_leverage_joint_training_level', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_value', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_description', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_source', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'lang_comm_int_in_language_development_level', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_value', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_description', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_source', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'lang_comm_int_in_scripture_translation_level', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_value', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_description', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_source', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'access_to_scripture_in_lwc_level', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_value', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_description', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_source', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'begin_work_geo_challenges_level', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_value', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_description', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_source', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'begin_work_rel_pol_obstacles_level', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_value', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_description', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_source', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
   values ('Write', 'suggested_strategies', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1);
  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'comments', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'created_at', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'created_by', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'modified_at', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'modified_by', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'owning_person', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'owning_group', vFieldOperationsDirectorRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'id', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'prioritization', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'progress_bible', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'location_long', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'island', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'province', vControllerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'first_language_population', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'population_value', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'egids_level', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'egids_value', vControllerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'least_reached_progress_jps_level', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'least_reached_value', vControllerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'partner_interest_level', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_value', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_description', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_source', vControllerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'multiple_languages_leverage_linguistic_level', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_value', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_description', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_source', vControllerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'multiple_languages_leverage_joint_training_level', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_value', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_description', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_source', vControllerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'lang_comm_int_in_language_development_level', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_value', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_description', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_source', vControllerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'lang_comm_int_in_scripture_translation_level', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_value', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_description', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_source', vControllerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'access_to_scripture_in_lwc_level', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_value', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_description', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_source', vControllerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'begin_work_geo_challenges_level', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_value', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_description', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_source', vControllerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'begin_work_rel_pol_obstacles_level', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_value', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_description', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_source', vControllerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
   values ('Write', 'suggested_strategies', vControllerRoleId, 'sc.languages', 1, 1, 1, 1);
  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'comments', vControllerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'created_at', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'created_by', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'modified_at', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'modified_by', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'owning_person', vControllerRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'owning_group', vControllerRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'id', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'prioritization', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'progress_bible', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'location_long', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'island', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'province', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'first_language_population', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'population_value', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'egids_level', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'egids_value', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'least_reached_progress_jps_level', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'least_reached_value', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'partner_interest_level', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_value', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_description', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'partner_interest_source', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'multiple_languages_leverage_linguistic_level', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_value', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_description', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_linguistic_source', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'multiple_languages_leverage_joint_training_level', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_value', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_description', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'multiple_languages_leverage_joint_training_source', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'lang_comm_int_in_language_development_level', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_value', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_description', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_language_development_source', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'lang_comm_int_in_scripture_translation_level', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_value', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_description', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'lang_comm_int_in_scripture_translation_source', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'access_to_scripture_in_lwc_level', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_value', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_description', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'access_to_scripture_in_lwc_source', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'begin_work_geo_challenges_level', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_value', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_description', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_geo_challenges_source', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'begin_work_rel_pol_obstacles_level', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_value', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_description', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'begin_work_rel_pol_obstacles_source', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
   values ('Write', 'suggested_strategies', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1);
  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'comments', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values
  ('Write', 'created_at', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'created_by', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'modified_at', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'modified_by', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'owning_person', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1),
  ('Write', 'owning_group', vLeadFinancialAnalystRoleId, 'sc.languages', 1, 1, 1, 1);

  -- grants on organizations
  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'id', vProjectManagerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'neo4j', vProjectManagerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'created_at', vProjectManagerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'created_by', vProjectManagerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'modified_at', vProjectManagerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'modified_by', vProjectManagerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'name', vProjectManagerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'sensitivity', vProjectManagerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'primary_location', vProjectManagerRoleId, 'common.organizations', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'id', vRegionalDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'neo4j', vRegionalDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'created_at', vRegionalDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'created_by', vRegionalDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'modified_at', vRegionalDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'modified_by', vRegionalDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'name', vRegionalDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'sensitivity', vRegionalDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'primary_location', vRegionalDirectorRoleId, 'common.organizations', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'id', vFieldOperationsDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'neo4j', vFieldOperationsDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'created_at', vFieldOperationsDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'created_by', vFieldOperationsDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'modified_at', vFieldOperationsDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'modified_by', vFieldOperationsDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'name', vFieldOperationsDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'sensitivity', vFieldOperationsDirectorRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'primary_location', vFieldOperationsDirectorRoleId, 'common.organizations', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'id', vControllerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'neo4j', vControllerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'created_at', vControllerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'created_by', vControllerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'modified_at', vControllerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'modified_by', vControllerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'name', vControllerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'sensitivity', vControllerRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'primary_location', vControllerRoleId, 'common.organizations', 1, 1, 1, 1);

  insert into admin.role_column_grants(access_level, column_name, role, table_name, created_by, modified_by, owning_person, owning_group)
  values ('Write', 'id', vLeadFinancialAnalystRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'neo4j', vLeadFinancialAnalystRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'created_at', vLeadFinancialAnalystRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'created_by', vLeadFinancialAnalystRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'modified_at', vLeadFinancialAnalystRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'modified_by', vLeadFinancialAnalystRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'name', vLeadFinancialAnalystRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'sensitivity', vLeadFinancialAnalystRoleId, 'common.organizations', 1, 1, 1, 1),
   ('Write', 'primary_location', vLeadFinancialAnalystRoleId, 'common.organizations', 1, 1, 1, 1);

END; $$;

call admin.roles_migration();
