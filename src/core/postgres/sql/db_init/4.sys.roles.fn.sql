create or replace function public.sys_create_role(
    in pRoleName VARCHAR(255),
    in pOrgName VARCHAR(255)
)
returns INT
language plpgsql
as $$
declare
    vResponseCode INT;
    vSysRoleId INT;
    vOrgId INT;
begin
    SELECT id
    FROM public.organizations_data
    INTO vOrgId
    WHERE organizations_data.name = pOrgName;
    IF FOUND THEN
        SELECT id
        FROM public.global_roles_data
        INTO vSysRoleId
        WHERE global_roles_data.org = vOrgId
            AND global_roles_data.name = pRoleName;
        IF NOT FOUND THEN
            INSERT INTO public.global_roles_data("org", "name")
            VALUES (vOrgId, pRoleName);
            vResponseCode := 0;
        ELSE
            vResponseCode := 1;
        END IF;
    ELSE
        vResponseCode := 1;
    END IF;
    return vResponseCode;
end; $$;

create or replace function public.sys_add_role_grant(
    in pRoleName VARCHAR(255),
    in pOrgName VARCHAR(255),
    in pTableName public.table_name,
    in pColumnName VARCHAR(255),
    in pAccessLevel public.access_level
)
returns INT
language plpgsql
as $$
declare
    vResponseCode INT;
    vSysRoleId INT;
    vSysRoleId2 INT;
    vOrgId INT;
begin
    SELECT id
    FROM public.organizations_data
    INTO vOrgId
    WHERE organizations_data.name = pOrgName;
    IF FOUND THEN
        SELECT id
        FROM public.global_roles_data
        INTO vSysRoleId
        WHERE global_roles_data.org = vOrgId
            AND global_roles_data.name = pRoleName;
        IF FOUND THEN
            SELECT global_role
            FROM public.global_role_column_grants_data
            INTO vSysRoleId2
            WHERE public.global_role_column_grants_data.global_role = vSysRoleId
                AND public.global_role_column_grants_data.table_name = pTableName
                AND public.global_role_column_grants_data.column_name = pColumnName
                AND public.global_role_column_grants_data.access_level = pAccessLevel;
            IF NOT FOUND THEN
                INSERT INTO public.global_role_column_grants_data("global_role", "table_name", "column_name", "access_level")
                VALUES (vSysRoleId, pTableName, pColumnName, pAccessLevel);
                vResponseCode := 0;
            ELSE
                vResponseCode := 1;
            END IF;
        ELSE
            vResponseCode := 1;
        END IF;
    ELSE
        vResponseCode := 1;
    END IF;
    return vResponseCode;
end; $$;

create or replace function public.sys_add_role_member(
    in pRoleName VARCHAR(255),
    in pOrgName VARCHAR(255),
    in pUserEmail VARCHAR(255)
)
returns INT
language plpgsql
as $$
declare
    vResponseCode INT;
    vSysRoleId INT;
    vOrgId INT;
    vSysPersonId INT;
begin
    SELECT id
    FROM public.organizations_data
    INTO vOrgId
    WHERE organizations_data.name = pOrgName;
    IF FOUND THEN
        SELECT id
        FROM public.global_roles_data
        INTO vSysRoleId
        WHERE global_roles_data.org = vOrgId
            AND global_roles_data.name = pRoleName;
        IF FOUND THEN
            select person
            from public.users_data
            into vSysPersonId
            where users_data.email = pUserEmail;
            if found then
                INSERT INTO public.global_role_memberships_data("person", "global_role")
                VALUES (vSysPersonId, vSysRoleId);
                vResponseCode := 0;
            else
                vResponseCode := 1;
            end if;
        ELSE
            vResponseCode := 1;
        END IF;
    ELSE
        vResponseCode := 1;
    END IF;
    return vResponseCode;
end; $$;