CREATE OR REPLACE PROCEDURE bootstrap(
  IN p_email VARCHAR(255),
  IN p_password VARCHAR(50),
  inout error_type varchar(32)
)
LANGUAGE PLPGSQL
AS $$
DECLARE
  vPeopleCount int; -- if this is a fresh db or not
  vPersonId uuid;
  vOrgId uuid;
  vAdminRoleId uuid;
  vAdminGroupId uuid;
  vNonAdminPersonId uuid;
  vPublicPersonId uuid;
  vPublicGroupId uuid;
  vPublicRoleId uuid;
  vTableOfLanguagesId uuid;
  vCommonLanguagesId uuid;
  vCommonSiteTextStringsId uuid;
BEGIN
  select count(id)
  from admin.people
  into vPeopleCount;

  if vPeopleCount = 0 then
    -- people --------------------------------------------------------------------------------

    -- Root user
    insert into admin.people(sensitivity_clearance)
    values ('High')
    returning id
    into vPersonId;

    -- public user
    insert into admin.people(sensitivity_clearance)
    values ('Low')
    returning id
    into vPublicPersonId;

    -- create token for the public 'person'
    insert into admin.tokens(token, person) values ('public', vPublicPersonId);

    -- groups -------------------------------------------------------------------------------------

    -- Administrators Group
    insert into admin.groups(name, created_by, modified_by, owning_person)
    values ('Administrators', vPersonId, vPersonId, vPersonId)
    returning id
    into vAdminGroupId;

    -- Public Group
    insert into admin.groups(name, created_by, modified_by, owning_person)
    values ('Public', vPersonId, vPersonId, vPersonId)
    returning id
    into vPublicGroupId;

    -- organization ------------------------------------------------------------------------------------------

    -- Seed Company
    insert into common.organizations(name, sensitivity, created_by, modified_by, owning_person, owning_group)
    values ('Seed Company', 'Low', vPersonId, vPersonId, vPersonId, vAdminGroupId)
    returning id
    into vOrgId;

    -- users ----------------------------------------------------------------------------------------------------

    -- Root user
    insert into admin.users(id, email, password, created_by, modified_by, owning_person, owning_group)
    values (vPersonId, p_email, p_password, vPersonId, vPersonId, vPersonId, vAdminGroupId);

    -- global roles ----------------------------------------------------------------------------------------------------

    -- Administrator role
    insert into admin.roles(name, created_by, modified_by, owning_person, owning_group)
    values ('Administrator', vPersonId, vPersonId, vPersonId, vAdminGroupId)
    returning id
    into vAdminRoleId;

    -- Public role
    insert into admin.roles(name, created_by, modified_by, owning_person, owning_group)
    values ('Public', vPersonId, vPersonId, vPersonId, vAdminGroupId)
    returning id
    into vPublicRoleId;

    -- global role memberships ------------------------------------------------------------------------------------------

    -- Give Root user the Administrator role
    insert into admin.role_memberships(role, person, created_by, modified_by, owning_person, owning_group) values
    (vAdminRoleId, vPersonId, vPersonId, vPersonId, vPersonId, vAdminGroupId);

    -- role table grants ------------------------------------------------------------------------------------------

    -- group memberships ----------------------------------------------------------------------------------------------------
    insert into admin.group_memberships(group_id, person, created_by, modified_by, owning_person, owning_group)
    values (vAdminGroupId, vPersonId, vPersonId, vPersonId, vPersonId, vAdminGroupId);

  end if;

END; $$;
