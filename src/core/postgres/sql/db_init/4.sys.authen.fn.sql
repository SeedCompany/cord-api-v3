create or replace function public.sys_register(
    in pEmail VARCHAR(255),
    in pPassword VARCHAR(50),
    in pOrgName VARCHAR(255)
)
returns INT
language plpgsql
as $$
declare
    vResponseCode INT;
    vSysPersonId INT;
    vOrgId INT;
begin
    SELECT person
    FROM public.users_data
    INTO vSysPersonId
    WHERE users_data.email = pEmail;
    IF NOT found THEN
        SELECT id
        FROM public.organizations_data
        INTO vOrgId
        WHERE organizations_data.name = pOrgName;
        IF found THEN
            INSERT INTO public.people_data VALUES (DEFAULT)
            RETURNING id
            INTO vSysPersonId;
            INSERT INTO public.users_data("person", "email", "password", "owning_org")
            VALUES (vSysPersonId, pEmail, pPassword, vOrgId);
            vResponseCode := 0;
        ELSE
            vResponseCode := 1;
        END IF;
    ELSE
        vResponseCode := 1;
    END IF;
    return vResponseCode;
end; $$;

create or replace function public.sys_login(
    in pEmail VARCHAR ( 255 ),
    in pPassword VARCHAR ( 50 ),
    in pToken VARCHAR ( 512 )
)
returns INT
language plpgsql
as $$
declare
    vResponseCode INT;
    vRow public.users_data%ROWTYPE;
    vId INT;
begin
    SELECT *
    FROM public.users_data
    INTO vRow
    WHERE users_data.email = pEmail AND users_data.password = pPassword;
    IF found THEN
        INSERT INTO public.tokens("token", "person")
        VALUES (pToken, vRow.person);
        vResponseCode := 0;
    ELSE
        vResponseCode := 2;
    END IF;
        return vResponseCode;
end; $$;