-- trigger function on insert for public.people
-- create or replace function public.t_people_d_security_deletes_person()
-- returns trigger
-- language plpgsql
-- as $$
-- declare 
-- 	rec1 record;
--     rec2 record;
--     base_schema_table_name text;
--     security_schema_table_name text;
--     row_sensitivity_clearance boolean;
-- begin
--     -- execute format('set schema '|| quote_literal(TG_ARGV[0]));

-- 	for rec1 in (select table_name from information_schema.tables where table_schema = TG_ARGV[0] and table_name like '%_data' order by table_name) loop 

--         raise info 'table_name: %', rec1.table_name;
--         base_schema_table_name := TG_ARGV[0] || '.' || rec1.table_name;
--         security_schema_table_name := replace(base_schema_table_name, '_data', '_security');

--        execute format('delete from '|| security_schema_table_name||' where __person_id = ' || old.id);

--     end loop;
--     raise info 'done';
-- 	return new;
-- end; $$;

-- drop trigger if exists delete_people_public_security_trigger on public.people_data;
-- drop trigger if exists delete_people_sc_security_trigger on public.people_data;


-- create trigger delete_people_public_security_trigger 
-- after delete 
-- on public.people_data
-- for each row 
-- execute procedure public.t_people_d_security_deletes_person('public');

-- create trigger delete_people_sc_security_trigger 
-- after delete 
-- on public.people_data
-- for each row 
-- execute procedure public.t_people_d_security_deletes_person('sc');