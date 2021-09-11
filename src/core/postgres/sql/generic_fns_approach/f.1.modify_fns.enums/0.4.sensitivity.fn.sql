create or replace procedure public.sensitivity_fn(
    pTableName text,
    pId int, 
    new_sensitivity public.sensitivity,
    pToggleSensitivity public.toggle_sensitivity,
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

    if pToggleSensitivity = 'DontUpdateIsCleared' then 
        -- early return
        return;
    end if; 
        -- only insert 
    for rec1 in execute format('select id, sensitivity_clearance from public.people_data') loop
        if (new_sensitivity = 'Medium' and rec1.sensitivity_clearance = 'Low') or 
        (new_sensitivity = 'High' and (rec1.sensitivity_clearance = 'Medium' or rec1.sensitivity_clearance = 'Low')) then 

            execute format('update  %I.%I set __is_cleared = false where __person_id = '|| rec1.id || ' and '|| ' __id = '|| pId, split_part(security_table_name, '.',1), split_part(security_table_name, '.',2));
            -- get id reference from the data table
            call public.mv_fn(pTableName, pToggleMV);
        end if;    
    end loop; 
    return;
  
end; $$;


create or replace procedure public.people_sensitivity_fn(
    pId int, 
    new_sensitivity_clearance public.sensitivity,
    pToggleSensitivity public.toggle_sensitivity,
    pToggleMV public.toggle_mv
)
language plpgsql 
as $$ 
declare 
security_table_name text;
data_table_row_sensitivity public.sensitivity;
rec1 record;
rec2 record;
begin
    

    if pToggleSensitivity = 'DontUpdateIsCleared' then 
        -- early return
        return;
    end if;

    for rec1 in (select table_name, table_schema from information_schema.tables where (table_schema = 'public' or table_schema = 'sc') and table_name like '%_data') loop 

        perform column_name 
        FROM information_schema.columns 
        WHERE table_schema = rec1.table_schema and table_name = rec1.table_name and column_name='sensitivity';
        if found then 
            for rec2 in  execute format('select id from %I.%I', rec1.table_schema, rec1.table_name) loop
                execute format('select sensitivity from  %I.%I  where id = ' || rec2.id, rec1.table_schema, rec1.table_name) into data_table_row_sensitivity;
                if (data_table_row_sensitivity = 'Medium' and new_sensitivity_clearance = 'Low') or 
                (data_table_row_sensitivity = 'High' and (new_sensitivity_clearance = 'Medium' or new_sensitivity_clearance = 'Low')) then 

                    execute format('update %I.%I set __is_cleared = false where __person_id = '|| pId || ' and '|| ' __id = '|| rec2.id, rec1.table_schema, replace(rec1.table_name, '_data', '_security'));
                else 
                    execute format('update %I.%I  set __is_cleared = true where __person_id = '|| pId || ' and '|| ' __id = '|| rec2.id,rec1.table_schema, replace(rec1.table_name, '_data', '_security'));
                end if; 
 
            end loop; 
                call public.mv_fn(rec1.table_schema || '.' ||rec1.table_name, pToggleMV);
        end if; 
	end loop;
    return;
	
end; $$;



