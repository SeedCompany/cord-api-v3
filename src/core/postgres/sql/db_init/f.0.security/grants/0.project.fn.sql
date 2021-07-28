-- create or replace function public.get_project_access_level(p_id int, p_person_id int, p_table_name text, p_column_name varchar(255))
-- returns public.access_level
-- language plpgsql
-- as $$
-- declare 
--     rec1 record;
--     rec2 record;
--     rec3 record; 
--     project_column text;
--     new_access_level public.access_level;
-- begin
    

--      if p_table_name = 'public.locations_data' then 
--         project_column := 'primary_location'; 
--     elsif p_table_name = 'public.organizations_data' then 
--         project_column := 'primary_org'; 
--     end if;

--     for rec1 in execute format('select id from public.projects_data where '|| project_column || ' = ' || p_id) loop 
--     raise info 'rec1: %', rec1; 

--         for rec2 in (select project_role from public.project_member_roles_data where person = p_person_id and project = rec1.id) loop 
--         raise info 'rec2: %', rec2; 

--             for rec3 in (select  access_level from public.project_role_column_grants_data where table_name = cast(p_table_name as public.table_name) and column_name = p_column_name and project_role = rec2.project_role) loop 
--             raise info 'rec3: %', rec3; 
            
--                 if new_access_level is null or new_access_level = 'Read' and rec3.access_level is not null then 
--                     new_access_level := rec3.access_level; 
--                 end if;

--             end loop; 
        
--         end loop; 

--     end loop; 
--     return new_access_level;
-- end; $$;