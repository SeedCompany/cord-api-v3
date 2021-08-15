/*
pPersonId => person using the function
pTableName => table you are inserting the record into
pRecord => hstore object 
pToggleSecurity => 0,1,2 
    0 - don't insert into security tables, 
    1 - only update access level of columns after inserting, 
    2 - update both access level and __is_cleared after inserting 
pToggleMV => 0,1,2
    0 - don't refresh materialized view, 
    1 - refresh materialized view, 
    2 - refresh materialized view concurrently
pToggleHistory => 0,1
    0 - don't insert into history tables, 
    1 - insert into history tables
pToggleGranters => 0,1,2
    0 - don't refresh security tables or materialized views, 
    1 - refresh security tables, 
    2 - refresh security tables & materialized views 
    3 - refresh security tables & materialized views concurrently
*/

create or replace procedure public.create(pPersonId int, pTableName text, 
-- get record
pRecord hstore,
pToggleSecurity int, 
pToggleMV int, 
pToggleHistory int,
pToggleGranters int
)
-- returns int 
language plpgsql
as $$ 
declare
rec1 record;
rec2 record;
rec3 record; 
permissionExists boolean;
column_access_level public.access_level;
column_data_type text;
column_udt_name text;
security_table_name text;
sql_string_keys text;
sql_string_values text; 
record_id int;
begin  
    
    permissionExists := false; 
-- check if person has "create" permission on table
    -- for rec1 in (select global_role from global_role_table_permissions where table_permission = 'Create' and table_name = pTableName) loop
    --     raise info 'rec1: %', rec1;
    --     perform person from global_role_memberships where person = pPersonId and global_role = rec1.global_role;
    --     if found then 
    --         permissionExists := true;
    --         exit;
    --     end if;
    -- end loop; 
    -- if permissionExists = false then 
    --     raise notice 'person does not have permission'; 
    --     return 2;
    -- end if;
-- loop through ever key in pRecord and check if user has "write" permission from security table. if they don't for even one key then raise exception and exit function
    -- security_table_name := replace(pTableName, '_data', '_security');
    -- for rec2 in (select skeys(pRecord)) loop 
    --     select public.get_global_access_level(pPersonId, pTableName, rec2.skeys) into column_access_level;
    --     raise info 'create.fn column_access_level: %', column_access_level;
    --     if column_access_level is null or column_access_level != 'Write' then 
    --         raise notice 'don''t have write access to column: % ', rec2.skeys;
    --         return 2;
    --     end if;
    -- end loop;
-- insert row! 
    sql_string_keys := 'insert into '|| pTableName || '(';
    sql_string_values := ') values (';
    for rec3 in (select skeys(pRecord), svals(pRecord)) loop 
        sql_string_keys := sql_string_keys || rec3.skeys || ',';
    
        select data_type, udt_name into column_data_type, column_udt_name from information_schema.columns where table_schema = split_part(pTableName, '.',1) and table_name = split_part(pTableName, '.', 2) and column_name = rec3.skeys; 

        if column_data_type = 'ARRAY'then 
            sql_string_values := sql_string_values || 'ARRAY' || rec3.svals ||'::' ||  'public.' || substr(column_udt_name, 2, length(column_udt_name)-1) || '[],';
        else 
            sql_string_values := sql_string_values || quote_literal(rec3.svals) || ',';
        end if;

    end loop;
-- removing the final comma
    sql_string_keys := substr(sql_string_keys,1,length(sql_string_keys) - 1);
    sql_string_values := substr(sql_string_values,1,length(sql_string_values) - 1) || ') returning id';
    execute format(sql_string_keys || sql_string_values) into record_id;

    -- might need an entirely different fn for public.people_data
    call public.history_fn(pTableName, pToggleHistory, pRecord);

    if pTableName = 'public.people_data' then 
        call public.people_security_fn(record_id, pToggleSecurity, pToggleMV);
    elsif pTableName like '%_data' then
        call public.security_fn(pTableName, record_id, pToggleSecurity, pToggleMV); 
    end if;

    if pTableName = 'public.projects_data' or 
    pTableName = 'public.project_member_roles_data' or
    pTableName = 'public.project_role_column_grants_data' or 
    pTableName = 'public.global_role_column_grants' or 
    pTableName = 'public.global_role_memberships' then 
        call public.granters_fn(pToggleGranters);
    end if;

     
     
    if pTableName != 'public.projects_data' and 
    pTableName != 'public.project_member_roles_data' and
    pTableName != 'public.project_role_column_grants_data' and 
    pTableName != 'public.global_role_column_grants' and 
    pTableName != 'public.global_role_memberships' then 
        call public.mv_fn(pTableName, pToggleMV);
    end if;
    
    return;
end; $$;

