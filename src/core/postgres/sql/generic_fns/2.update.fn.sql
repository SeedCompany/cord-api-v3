create or replace procedure public.update(
pPersonId int, 
pId int, 
pTableName text, 
pRecord hstore, 
pToggleSensitivity public.toggle_sensitivity,
pToggleMV public.toggle_mv,
pToggleHistory public.toggle_history,
pToggleGranters public.toggle_granters
-- inout pUpdatedRow hstore
)
language plpgsql
as $$ 
declare
rec1 record;
rec2 record; 
column_access_level public.access_level;
column_data_type text;
column_udt_name text;
security_table_name text;
table_is_cleared boolean;
table_column_name text;
call_sensitivity int := 0;
sqlString text;
new_sensitivity_clearance public.sensitivity;
new_sensitivity public.sensitivity;
updated_row record;
begin

-- -- get __is_cleared and loop through every column in security table and make sure it has write permission 
--     security_table_name := replace(pTableName, '_data', '_security');
--     for rec1 in (select column_name into table_column_name from information_schema.columns where table_schema = split_part(pTableName, '.',1) and table_name = split_part(pTableName, '.', 2)) loop    
--         execute format('select _%I, __is_cleared from %I where __id = '|| pId ' and __person_id = '|| pPersonId , rec1.column_name, security_table_name) into column_access_level, table_is_cleared;
--         raise info 'create.fn column_access_level: %', column_access_level;
--         if __is_cleared = false or column_access_level is null or column_access_level != 'Write' then 
--             raise notice 'don''t have write access to column: % ', rec1.column_name;
--             return 2;
--         end if;
--     end loop;

-- update row! 
    sqlString := 'update '|| pTableName || ' set ';
    for rec2 in (select skeys(pRecord), svals(pRecord)) loop 
    	raise info 'key:%, value:%', rec2.skeys, rec2.svals;

        select data_type, udt_name into column_data_type, column_udt_name from information_schema.columns where table_schema = split_part(pTableName, '.',1) and table_name = split_part(pTableName, '.', 2) and column_name = rec2.skeys; 
		if rec2.skeys = 'sensitivity' then 
            new_sensitivity = rec2.svals; 
        end if;
        if rec2.skeys = 'sensitivity_clearance' then
            new_sensitivity_clearance = rec2.svals;
        end if; 
        if column_data_type = 'ARRAY'then 
            sqlString := sqlString || rec2.skeys || ' = ' || 'ARRAY' || rec2.svals ||'::' ||  'public.' || substr(column_udt_name, 2, length(column_udt_name)-1) || '[],';
        else 
            sqlString:= sqlString || rec2.skeys || ' = ' || quote_literal(rec2.svals) || ',' ;
        end if;

    end loop;
    sqlString := substr(sqlString,1,length(sqlString) - 1) || ' where id = '|| pId || ' returning *';
    execute format(sqlString) into updated_row;
    raise info 'updated_row: %', updated_row;
    -- pUpdatedRow := hstore(updated_row);
    if new_sensitivity_clearance is not null then  
        call public.people_sensitivity_fn(pId,
        new_sensitivity_clearance, pToggleSensitivity,pToggleMV);
    elsif new_sensitivity is not null then 
        call public.sensitivity_fn(pTableName, pId, new_sensitivity,pToggleSensitivity, pToggleMV);
	end if;
	raise info 'hstore in update fn: %', hstore(updated_row);
  	call public.history_fn(pTableName, pToggleHistory, hstore(updated_row));
     if pTableName = 'public.projects_data' or 
    pTableName = 'public.project_member_roles_data' or
    pTableName = 'public.project_role_column_grants' or 
    pTableName = 'public.global_role_column_grants' or 
    pTableName = 'public.global_role_memberships' then 
        call public.granters_fn(pToggleGranters);
    end if;

    if pTableName != 'public.projects_data' and 
    pTableName != 'public.project_member_roles_data' and
    pTableName != 'public.project_role_column_grants' and 
    pTableName != 'public.global_role_column_grants' and 
    pTableName != 'public.global_role_memberships' then 
        call public.mv_fn(pTableName, pToggleMV);
    end if;
    
    return;
end; $$;
