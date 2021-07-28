-- go to every security table and update the __is_cleared column for every id 
-- create or replace function public.gt_people_u_security_update_is_cleared_columns()
-- returns integer
-- language plpgsql
-- as $$
-- declare 
-- 	rec1 record;
--     rec2 record;
--     base_schema_table_name text;
--     security_schema_table_name text;
--     data_table_row_sensitivity public.sensitivity;
-- begin
--     -- execute format('set schema '|| quote_literal(TG_ARGV[0]));

-- 	for rec1 in (select table_name from information_schema.tables where table_schema = TG_ARGV[0] and table_name like '%_data' order by table_name) loop 

--         raise info 'table_name: %', rec1.table_name;
--         base_schema_table_name := TG_ARGV[0] || '.' || rec1.table_name;

--     perform column_name 
--     FROM information_schema.columns 
--     WHERE table_schema = TG_ARGV[0] and table_name = rec1.table_name and column_name='sensitivity';

--     if found then 
--         base_schema_table_name := TG_ARGV[0] || '.' || rec1.table_name;
--         security_schema_table_name := replace(base_schema_table_name, '_data', '_security');

--         for rec2 in  execute format('select id from '|| base_schema_table_name) loop

--             execute format('select sensitivity from ' || base_schema_table_name || ' where id = ' || rec2.id) into data_table_row_sensitivity;

--             raise info 'data_table_row_sensitivity: % | person_sensitivity_clearance: %', data_table_row_sensitivity, new.sensitivity_clearance;
            
--             if (data_table_row_sensitivity = 'Medium' and new.sensitivity_clearance = 'Low') or 
--             (data_table_row_sensitivity = 'High' and (new.sensitivity_clearance = 'Medium' or new.sensitivity_clearance = 'Low')) then 

--                 execute format('update ' || security_schema_table_name || ' set __is_cleared = false where __person_id = '|| new.id || ' and '|| ' __id = '|| rec2.id);
--             else 
--                 execute format('update ' || security_schema_table_name || ' set __is_cleared = true where __person_id = '|| new.id || ' and '|| ' __id = '|| rec2.id);
--             end if;  
--         end loop;
--     end if;    


--     end loop;
--     raise info 'done';
-- 	return 0;
-- end; $$;

-- drop trigger if exists update_people_public_sensitivity_trigger on public.people_data;
-- drop trigger if exists update_people_sc_sensitivity_trigger on public.people_data;


-- create trigger update_people_public_sensitivity_trigger 
-- after update 
-- on public.people_data
-- for each row 
-- execute procedure public.gt_people_u_security_update_is_cleared_columns('public');

-- create trigger update_people_sc_sensitivity_trigger 
-- after update 
-- on public.people_data
-- for each row 
-- execute procedure public.gt_people_u_security_update_is_cleared_columns('sc');