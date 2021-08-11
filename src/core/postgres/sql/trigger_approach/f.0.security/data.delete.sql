-- inserts the new id into the security table for each member 
-- trigger function for each data table
-- create or replace function public.gt_data_d_security_d()
-- returns integer
-- language plpgsql
-- as $$
-- declare 
-- base_schema_table_name text;
-- security_schema_table_name text;
-- row_sensitivity_clearance boolean;
-- rec1 record;  
-- begin                                           
--         base_schema_table_name := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;
-- 		security_schema_table_name := replace(base_schema_table_name, '_data', '_security');
-- 		raise info 'security table: %', security_schema_table_name;
		   

--         execute format('delete from '|| security_schema_table_name || ' where __id = '|| old.id); 
--             --  is_cleared instead of __is_cleared
      
-- 		return 0;
-- end; $$;

-- CREATE OR REPLACE FUNCTION public.create_data_triggers(p_schema_name text)
-- RETURNS VOID
-- LANGUAGE PLPGSQL
-- AS $$
-- declare 
-- 	 rec1 record;
-- 	 delete_trigger_name text;
--    base_schema_table_name text; 
-- begin


-- 	for rec1 in (SELECT table_name FROM information_schema.tables
-- 				WHERE table_schema = p_schema_name and table_name like '%_data'
-- 				ORDER BY table_name) loop 

--       base_schema_table_name := p_schema_name || '.' || rec1.table_name;
--       delete_trigger_name := quote_ident(rec1.table_name||'_security_delete_trigger');

--       if base_schema_table_name != 'public.people_data' then 

--         -- INSERT TRIGGER
--         execute format('DROP TRIGGER IF EXISTS '|| delete_trigger_name || ' ON ' ||base_schema_table_name);
--         execute format('CREATE TRIGGER ' || delete_trigger_name
--         || ' AFTER DELETE
--         ON ' || base_schema_table_name || 
--         ' FOR EACH ROW
--         EXECUTE PROCEDURE public.gt_data_d_security_d()'); 
        
--       end if;

-- 	END loop;
-- 	raise info 'DONE';
-- end; $$;

-- select public.create_data_triggers('public');
-- select public.create_data_triggers('sc');