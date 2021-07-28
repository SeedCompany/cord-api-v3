create or replace function public.security_fn(
    pTableName text,
    pId int, 
    pToggleSecurity int
)
returns int 
language plpgsql 
as $$ 
declare 
security_table_name text;
rec1 record;
begin
    security_table_name := replace(pTableName, 'data', 'security');
    perform  table_name from information_schema.tables where table_schema = split_part(security_table_name, '.',1) and table_name = split_part(security_table_name, '.', 2);

    if not found then 
        return 1;
    end if;

    if pToggleSecurity = 0 then 
        -- early return
        return 0;
    else
        -- only insert 
        for rec1 in execute format('select id, sensitivity_clearance from public.people_data') loop

            execute format('insert into  %I  (__id, __person_id, __is_cleared) values (' || pId || ',' || quote_literal(rec1.id) ||', true)', security_table_name);

            if pToggleSecurity = 2 then
            -- get access level and update newly inserted record


            else 
            -- get access level and sensitivity and update newly inserted record
                
            end if;

        end loop; 

        return 0;
    end if;

  
end; $$;


create or replace function public.gt_security_i_granters_get_access_level(securityTableName text, )
returns integer
language plpgsql 
as $$
declare
rec1 record; 
base_table_name text;
base_schema_table text;
base_schema_table_name text;
global_access_level public.access_level;
project_access_level public.access_level;
final_access_level public.access_level;
security_column_name text;
begin

    base_table_name := replace(TG_TABLE_NAME, '_security', '_data');
    base_schema_table_name := TG_TABLE_SCHEMA || '.' || base_table_name;

    -- find access level for every column of the newly inserted record

    for rec1 in (select cast(column_name as text) from information_schema.columns where table_schema = TG_TABLE_SCHEMA and table_name = base_table_name) loop 
        
        select public.get_global_access_level( new.__person_id, base_schema_table_name , rec1.column_name) into global_access_level;
               

        if base_schema_table_name = 'public.locations_data' or base_schema_table_name = 'public.organizations_data' then
            select public.get_project_access_level(new.__id, new.__person_id 
            , base_schema_table_name, rec1.column_name) into project_access_level;
        end if;

        if project_access_level = 'Write' then 
            final_access_level := 'Write';
        elsif project_access_level = 'Read' and global_access_level != 'Write' then
            final_access_level := 'Read';
        else 
            final_access_level := global_access_level;
        end if;

        raise info 'refresh fn global_access_level: % | project_access_level: % | final_access_level: %', global_access_level, project_access_level, final_access_level;
        

        if final_access_level is not null then 
            security_column_name := '_' || rec1.column_name;
            execute format('update %I.%I set '||security_column_name|| ' = ' 
                || quote_literal(final_access_level) || ' where __id = '|| new.__id  
                || ' and  __person_id = ' ||  new.__person_id, TG_TABLE_SCHEMA, TG_TABLE_NAME);
        end if;


    end loop; 
    return 0;
end;$$;


create or replace function public.gt_security_i_data_and_people_get_is_cleared()
returns integer
language plpgsql
as $$
declare 
    rec1 record;
    security_schema_table_name text;
    base_schema_table_name text;
    base_table_name text; 
    data_table_row_sensitivity public.sensitivity;
    person_sensitivity_clearance public.sensitivity;
begin

    base_table_name := replace(TG_TABLE_NAME,'_security', '_data');

    -- only proceed ahead if the data table has a column for sensitivity
    perform column_name 
    FROM information_schema.columns 
    WHERE table_schema = TG_TABLE_SCHEMA and table_name = base_table_name and column_name='sensitivity';

    if found then 
        base_schema_table_name := TG_TABLE_SCHEMA || '.' || base_table_name;
        security_schema_table_name := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;

        select sensitivity_clearance into person_sensitivity_clearance from public.people_data where id = new.__person_id;
        execute format('select sensitivity from ' || base_schema_table_name || ' where id = ' || new.__id) into data_table_row_sensitivity;

        raise info 'data_table_row_sensitivity: % | person_sensitivity_clearance: %', data_table_row_sensitivity, person_sensitivity_clearance;
        
        if (data_table_row_sensitivity = 'Medium' and person_sensitivity_clearance = 'Low') or 
        (data_table_row_sensitivity = 'High' and (person_sensitivity_clearance = 'Medium' or person_sensitivity_clearance = 'Low')) then 

            execute format('update ' || TG_TABLE_SCHEMA || '.%I set __is_cleared = false where __person_id = '|| new.__person_id || ' and '|| ' __id = '|| new.__id, TG_TABLE_NAME);
    

        end if;    
    end if; 
    return 0;   
end; $$;