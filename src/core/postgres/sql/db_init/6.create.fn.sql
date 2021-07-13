create or replace function public.create(pPersonId int, pTableName text, 
-- get record
pRecord hstore
)
returns int 
language plpgsql
as $$ 
declare
rec1 record;
rec2 record;
permissionExists boolean;
column_access_level public.access_level;
security_table_name text;
begin
    permissionExists := false; 
-- check if person has "create" permission on table
    for rec1 in (select global_role from global_role_table_permissions_data where table_permission = 'Create' and table_name = 'pTableName') loop
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
        select rec2.skeys into column_access_level from security_table_name where __person_id = pPersonId;
    end loop;
-- insert row! 

end; $$;