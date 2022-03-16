CREATE OR REPLACE PROCEDURE sil.sil_migrate_language_index(
    in pLang VARCHAR(3),
    in pCountry VARCHAR(2),
    in pNameType VARCHAR(2),
    in pName VARCHAR(75)
)
LANGUAGE PLPGSQL
AS $$
DECLARE
  vCommonId varchar(64);
  vPersonId varchar(64);
  vGroupId varchar(64);
BEGIN
  select id from admin.people  where sensitivity_clearance = 'High' into vPersonId;
  SELECT id FROM admin.groups INTO vGroupId WHERE name='Administrators';

  if vPersonId is not null then
    insert into common.languages(created_by, modified_by, owning_person, owning_group)
    values (vPersonId::uuid, vPersonId::uuid, vPersonId::uuid, vGroupId::uuid)
    returning id
    into vCommonId;

    insert into sil.language_index(id, lang, country, name_type, name, created_by, modified_by, owning_person, owning_group)
    values (vCommonId::uuid, pLang, pCountry, pNameType::sil.language_name_type, pName, vPersonId::uuid, vPersonId::uuid, vPersonId::uuid, vGroupId::uuid);

  end if;

END; $$;
