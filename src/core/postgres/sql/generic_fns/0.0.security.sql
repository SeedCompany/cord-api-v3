create or replace function public.get_project_access_level(p_id int, p_person_id int, p_table_name text, p_column_name varchar(255))
returns public.access_level
language plpgsql
as $$
declare 
    rec1 record;
    rec2 record;
    rec3 record; 
    project_column text;
    new_access_level public.access_level;
begin
    

    if p_table_name = 'public.locations_data' then 
        project_column := 'primary_location'; 
    elsif p_table_name = 'public.organizations_data' then 
        project_column := 'primary_org'; 
    end if;

    for rec1 in execute format('select id from public.projects_data where %I = ' || p_id, project_column) loop 
    raise info 'rec1: %', rec1; 

        for rec2 in (select project_role from public.project_member_roles_data where person = p_person_id and project = rec1.id) loop 
        raise info 'rec2: %', rec2; 

            for rec3 in (select  access_level from public.project_role_column_grants where table_name = cast(p_table_name as public.table_name) and column_name = p_column_name and project_role = rec2.project_role) loop 
            raise info 'rec3: %', rec3; 
            
                if new_access_level is null or new_access_level = 'Read' and rec3.access_level is not null then 
                    new_access_level := rec3.access_level; 
                end if;

            end loop; 
        
        end loop; 

    end loop; 
    return new_access_level;
end; $$;

create or replace function public.get_global_access_level(p_person_id int, p_table_name text, p_column_name varchar(255))
returns public.access_level
language plpgsql
as $$
declare 
    rec1 record;
    rec2 record;
    project_column text;
    new_access_level public.access_level;
    temp_access_level public.access_level;
begin
    

    for rec1 in (select global_role from public.global_role_memberships where person = p_person_id)loop 
    raise info 'globalfn: global_role: % | table_name: % | column_name: %', rec1.global_role, p_table_name, p_column_name;

        select access_level from public.global_role_column_grants into temp_access_level where cast(table_name as text) = p_table_name and column_name = p_column_name and global_role = rec1.global_role;

        raise info 'table_name:% | column_name: % | access_level: %', p_table_name, p_column_name, temp_access_level;

            if (new_access_level is null or new_access_level = 'Read') and temp_access_level is not null then 
                new_access_level := temp_access_level; 
            end if;

    end loop; 

    return new_access_level;
end; $$;


create or replace procedure public.get_access_level(pSecurityTableName text, pPersonId int, pId int, pToggleMV public.toggle_mv)
language plpgsql 
as $$
declare
rec1 record; 
base_table_name text;
global_access_level public.access_level;
project_access_level public.access_level;
final_access_level public.access_level;
security_column_name text;
begin
    -- find access level for every column of the newly inserted record
    base_table_name := replace(pSecurityTableName, 'security', 'data');
    for rec1 in (select cast(column_name as text) from information_schema.columns where table_schema = split_part(base_table_name, '.',1) and table_name = split_part(base_table_name, '.', 2)) loop 
        
        select public.get_global_access_level( pPersonId, base_table_name , rec1.column_name) into global_access_level;
               

        if base_table_name = 'public.locations_data' or base_table_name = 'public.organizations_data' then
            select public.get_project_access_level(pId, pPersonId 
            , base_table_name, rec1.column_name) into project_access_level;
        end if;

        -- comparing project_access_level and global_access_level
        if project_access_level = 'Write' then 
            final_access_level := 'Write';
        elsif project_access_level = 'Read' and global_access_level != 'Write' then
            final_access_level := 'Read';
        else 
            final_access_level := global_access_level;
        end if;

        raise info 'access_level fn global_access_level: % | project_access_level: % | final_access_level: %', global_access_level, project_access_level, final_access_level;
        

        if final_access_level is not null then 
            security_column_name := '_' || rec1.column_name;
            execute format('update %I.%I set '||security_column_name|| ' = ' 
                || quote_literal(final_access_level) || ' where __id = '|| pId  
                || ' and  __person_id = ' ||  pPersonId,split_part(pSecurityTableName, '.',1) , split_part(pSecurityTableName, '.', 2));
            if pToggleMV = 'RefreshMV' then
                execute format('refresh materialized view %I.%I', split_part(pSecurityTableName, '.', 1), replace(split_part(pSecurityTableName, '.', 2), '_security', '_materialized_view'));
            elsif pToggleMV = 'RefreshMVConcurrently' then 
                execute format('refresh materialized view concurrently %I.%I', split_part(pSecurityTableName, '.', 1), replace(split_part(pSecurityTableName, '.', 2), '_security', '_materialized_view'));
            end if;
        end if;
    end loop; 
    return;
end;$$;


create or replace procedure public.get_is_cleared(pSecurityTableName text, pPersonId int, pId int, pToggleMV public.toggle_mv)
language plpgsql
as $$
declare 
    rec1 record;
    base_table_name text; 
    data_sensitivity public.sensitivity;
    person_sensitivity_clearance public.sensitivity;
begin
    base_table_name := replace(pSecurityTableName, 'security', 'data');
    -- only proceed ahead if the data table has a column for sensitivity
    perform column_name 
    FROM information_schema.columns 
    WHERE table_schema = split_part(base_table_name, '.',1) and table_name = split_part(base_table_name, '.',2) and column_name='sensitivity';

    if found then 
        select sensitivity_clearance into person_sensitivity_clearance from public.people_data where id = pPersonId;

        execute format('select sensitivity from %I.%I where id = ' || pId, split_part(base_table_name, '.',1), split_part(base_table_name, '.',2)) into data_sensitivity;

        raise info 'data_sensitivity: % | person_sensitivity_clearance: %', data_sensitivity, person_sensitivity_clearance;
        
        -- update __is_cleared to false if person_sensitivity_clearance is less than data_sensitivity
        if (data_sensitivity = 'Medium' and person_sensitivity_clearance = 'Low') or 
        (data_sensitivity = 'High' and (person_sensitivity_clearance = 'Medium' or person_sensitivity_clearance = 'Low')) then 

            execute format('update  %I.%I set __is_cleared = false where __person_id = '|| pPersonId || ' and '|| ' __id = '|| pId,split_part(pSecurityTableName, '.',1), split_part(pSecurityTableName, '.',2) );
            if pToggleMV = 'RefreshMV' then
                execute format('refresh materialized view %I.%I', split_part(pSecurityTableName, '.', 1), replace(split_part(pSecurityTableName, '.', 2), '_security', '_materialized_view'));
            elsif pToggleMV = 'RefreshMVConcurrently' then 
                execute format('refresh materialized view concurrently %I.%I', split_part(pSecurityTableName, '.', 1), replace(split_part(pSecurityTableName, '.', 2), '_security', '_materialized_view'));
            end if;
        end if;    
    end if; 
    return;   
end; $$;


create or replace procedure public.security_fn(
    pTableName text,
    pId int, 
    pToggleSecurity public.toggle_security,
    pToggleMV public.toggle_mv
)
language plpgsql 
as $$ 
declare 
security_table_name text;
rec1 record;
begin
    security_table_name := replace(pTableName, 'data', 'security');
    perform  table_name from information_schema.tables where table_schema = split_part(security_table_name, '.',1) and table_name = split_part(security_table_name, '.', 2);

    if not found then 
        raise info 'data table doesn''t have security table';
        return;
    end if;

    if pToggleSecurity = 'NoSecurity' then 
        -- early return
        return;
    end if;
        -- only insert 
        for rec1 in execute format('select id, sensitivity_clearance from public.people_data') loop

            execute format('insert into  %I.%I  (__id, __person_id, __is_cleared) values (' || pId || ',' ||rec1.id ||', true)', split_part(security_table_name, '.',1),split_part(security_table_name, '.',2));

            if pToggleSecurity = 'UpdateAccessLevelSecurity' then
            -- update access level only

                call public.get_access_level(security_table_name, rec1.id, pId, pToggleMV);
            else 
            -- update access level and sensitivity
                call public.get_access_level(security_table_name, rec1.id, pId, pToggleMV);
                call public.get_is_cleared(security_table_name, rec1.id, pId, pToggleMV);
            end if;
        end loop; 
        return;
  
end; $$;


create or replace procedure public.people_security_fn(
    pId int, 
    pToggleSecurity public.toggle_security,
    pToggleMV public.toggle_mv
)
language plpgsql 
as $$ 
declare 
security_table_name text;
data_table_name text;
data_security_table_name text;
rec1 record;
rec2 record;
begin
    

    if pToggleSecurity = 'NoSecurity' then 
        -- early return
        return;
    end if;
        -- only insert 
        -- people_data -> 0,1
        -- locations_data -> 0,1
        -- organizations_data -> 0,1
        -- public.locations_security -> (0,0), (0,1) , (1,0), (1,1) 
        -- public.organizations_security -> (0,0), (0,1), (1,0), (1,1)
        -- public.people_security -> (0,0) , (0,1) , (1,1), (1,0)
        -- looping over all tables
        for rec1 in (select table_name, table_schema from information_schema.tables where (table_schema = 'public' or table_schema = 'sc') and table_name like '%_data') loop 

            data_table_name := rec1.table_schema || '.' || rec1.table_name;
            -- loops over all ids in the table
                for rec2 in execute format('select id from %I.%I', rec1.table_schema,rec1.table_name) loop 
                    raise info 'people.insert.fn rec2: %', rec2;
                    data_security_table_name := replace(data_table_name, '_data', '_security');

                    execute format('insert into %I.%I(__id, __person_id, __is_cleared) values (' || rec2.id || ',' || pId || ', true )',split_part(data_security_table_name, '.', 1), split_part(data_security_table_name, '.', 2));
                    if pToggleSecurity = 'UpdateAccessLevelSecurity' then
                    -- update access level only
                        call public.get_access_level(data_security_table_name, pId, rec2.id, pToggleMV);
                    else 
                    -- update access level and sensitivity
                        call public.get_access_level(data_security_table_name, pId, rec2.id, pToggleMV);
                        call public.get_is_cleared(data_security_table_name, pId, rec2.id, pToggleMV);
                    end if;

                    if data_table_name = 'public.people_data' and (pId != rec2.id) then 
                        execute format('insert into %I.%I(__id, __person_id, __is_cleared) values (' || pId || ',' || rec2.id || ', true )',split_part(data_security_table_name, '.', 1), split_part(data_security_table_name, '.', 2));
                        if pToggleSecurity = 'UpdateAccessLevelSecurity' then
                        -- update access level only
                            call public.get_access_level(data_security_table_name, rec2.id, pId, pToggleMV);
                        else 
                        -- update access level and sensitivity
                            call public.get_access_level(data_security_table_name, rec2.id, pId, pToggleMV);
                            call public.get_is_cleared(data_security_table_name,  rec2.id, pId, pToggleMV);
                        end if;
                    end if;
                end loop;     
        end loop; 
    return;
end; $$;



