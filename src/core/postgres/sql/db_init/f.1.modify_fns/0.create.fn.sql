create or replace function public.create(pPersonId int, pTableName text, 
-- get record
pRecord hstore,
pToggleSecurity int, 
pToggleMV int, 
pToggleHistory int,
pToggleGranters int
)
returns int 
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
sqlStringKeys text;
sqlStringValues text; 
begin
    permissionExists := false; 
-- check if person has "create" permission on table
    for rec1 in (select global_role from global_role_table_permissions_data where table_permission = 'Create' and table_name = pTableName) loop
        raise info 'rec1: %', rec1;
        perform person from global_role_memberships_data where person = pPersonId and global_role = rec1.global_role;
        if found then 
            permissionExists := true;
            exit;
        end if;
    end loop; 
    if permissionExists = false then 
        raise notice 'person does not have permission'; 
        return 2;
    end if;
-- loop through ever key in pRecord and check if user has "write" permission from security table. if they don't for even one key then raise exception and exit function
    security_table_name := replace(pTableName, '_data', '_security');
    for rec2 in (select skeys(pRecord)) loop 
        select public.get_global_access_level(pPersonId, pTableName, rec2.skeys) into column_access_level;
        raise info 'create.fn column_access_level: %', column_access_level;
        if column_access_level is null or column_access_level != 'Write' then 
            raise notice 'don''t have write access to column: % ', rec2.skeys;
            return 2;
        end if;
    end loop;
-- insert row! 
    sqlStringKeys := 'insert into '|| pTableName || '(';
    sqlStringValues := ') values (';
    for rec3 in (select skeys(pRecord), svals(pRecord)) loop 
        sqlStringKeys := sqlStringKeys || rec3.skeys || ',';
    
        select data_type, udt_name into column_data_type, column_udt_name from information_schema.columns where table_schema = split_part(pTableName, '.',1) and table_name = split_part(pTableName, '.', 2) and column_name = rec3.skeys; 

        if column_data_type = 'ARRAY'then 
            sqlStringValues := sqlStringValues || 'ARRAY' || rec3.svals ||'::' ||  'public.' || substr(column_udt_name, 2, length(column_udt_name)-1) || '[],';
        else 
            sqlStringValues := sqlStringValues || quote_literal(rec3.svals) || ',';
        end if;

    end loop;
-- removing the final comma
    sqlStringKeys := substr(sqlStringKeys,1,length(sqlStringKeys) - 1);
    sqlStringValues := substr(sqlStringValues,1,length(sqlStringValues) - 1) || ')';
    execute format(sqlStringKeys || sqlStringValues);

    -- might need an entirely different fn for public.people_data
    select public.security_fn(); 
    select public.mv_fn();
    select public.history_fn();
    select public.granters_fn();

    return 0;
end; $$;