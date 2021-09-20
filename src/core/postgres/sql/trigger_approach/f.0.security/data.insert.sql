-- inserts the new id into the security table for each member 
-- trigger function for each data table
create or replace function public.gt_data_i_security_i()
returns trigger
language plpgsql
as $$
declare 
base_schema_table_name text;
security_schema_table_name text;
row_sensitivity_clearance boolean;
rec1 record;  
begin                                           
      base_schema_table_name := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;
		security_schema_table_name := replace(base_schema_table_name, '_data', '_security');
		raise info 'data.insert.fn | security table: %', security_schema_table_name;

        
         for rec1 in execute format('select id, sensitivity_clearance from public.people_data') loop
            
            -- select public.get_sensitivity_clearance(new.id, rec1.id, rec1.sensitivity_clearance, TG_TABLE_SCHEMA, TG_TABLE_NAME) into row_sensitivity_clearance;

            execute format('insert into '|| security_schema_table_name || '(__id, __person_id, __is_cleared) values (' || new.id || ',' || quote_literal(rec1.id) ||', true)'); 
             
            --  is_cleared instead of __is_cleared
         end loop; 
      return new;
end; $$;

CREATE OR REPLACE FUNCTION public.create_data_triggers(p_schema_name text)
RETURNS VOID
LANGUAGE PLPGSQL
AS $$
declare 
	 rec1 record;
	 insert_trigger_name text;
   base_schema_table_name text; 
begin


	for rec1 in (SELECT table_name FROM information_schema.tables
				WHERE table_schema = p_schema_name and table_name like '%_data'
				ORDER BY table_name) loop 

      base_schema_table_name := p_schema_name || '.' || rec1.table_name;
      insert_trigger_name := quote_ident(rec1.table_name||'_security_insert_trigger');
      raise info 'data.insert.fn base_schema_table_name: %', base_schema_table_name;
      if base_schema_table_name != 'public.people_data' then 

        -- INSERT TRIGGER
        execute format('DROP TRIGGER IF EXISTS '|| insert_trigger_name || ' ON ' ||base_schema_table_name);
        execute format('CREATE TRIGGER ' || insert_trigger_name
        || ' AFTER INSERT
        ON ' || base_schema_table_name || 
        ' FOR EACH ROW
        EXECUTE PROCEDURE public.gt_data_i_security_i()'); 

      end if;

	END loop;
	raise info 'DONE';
end; $$;

select public.create_data_triggers('public');
select public.create_data_triggers('sc');