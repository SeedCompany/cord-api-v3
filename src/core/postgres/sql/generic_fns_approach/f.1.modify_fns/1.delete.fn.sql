create or replace function public.delete(pPersonId int, pId int, pTableName text)
returns int 
language plpgsql
as $$ 
declare
rec1 record;
rec2 record;
permissionExists boolean;
table_is_cleared boolean;
table_id public.access_level;
security_table_name text;
begin
--     permissionExists := false; 
-- -- check if person has "delete" permission on table
--     for rec1 in (select global_role from global_role_table_permissions where table_permission = 'Delete' and table_name = pTableName) loop
--         raise info 'rec1: %', rec1;
--         perform person from global_role_memberships where person = pPersonId and global_role = rec1.global_role;
--         if found then 
--             permissionExists := true;
--             exit;
--         end if;
--     end loop; 
--     if permissionExists = false then 
--         raise notice 'person does not have delete permission'; 
--         return 2;
--     end if;

-- check security table for __is_cleared and if _id has Write access level
    security_table_name := replace(pTableName, '_data', '_security');
    execute format('select __is_cleared,_id  from ' || security_table_name || ' where __id = ' || pId || ' and __person_id = '|| pPersonId) into table_is_cleared,table_id; 
    if table_is_cleared is false or table_id is null or table_id != 'Write' then 
        raise notice 'don''t have write access to _id column';
        return 2;
    end if;
   
-- delete row! 
    execute format('delete from '|| pTableName || ' where id = ' || pId);
    return 0;
end; $$;