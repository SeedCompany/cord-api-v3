-- -- p_table_name example: public.locations
-- create or replace function public.get_global_access_level(p_person_id int, p_table_name text, p_column_name varchar(255))
-- returns public.access_level
-- language plpgsql
-- as $$
-- declare 
--     rec1 record;
--     rec2 record;
--     project_column text;
--     new_access_level public.access_level;
--     temp_access_level public.access_level;
-- begin
    

--     for rec1 in (select global_role from public.global_role_memberships where person = p_person_id)loop 
--     raise info 'globalfn: global_role: % | table_name: % | column_name: %', rec1.global_role, p_table_name, p_column_name;

--         select access_level from public.global_role_column_grants into temp_access_level where cast(table_name as text) = p_table_name and column_name = p_column_name and global_role = rec1.global_role;

--         raise info 'table_name:% | column_name: % | access_level: %', p_table_name, p_column_name, temp_access_level;

--             if (new_access_level is null or new_access_level = 'Read') and temp_access_level is not null then 
--                 new_access_level := temp_access_level; 
--             end if;

--     end loop; 

--     return new_access_level;
-- end; $$;