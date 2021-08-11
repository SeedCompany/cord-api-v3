--  go to corresponding security table and update the __is_cleared for every person 

-- inserts the new id into the security table for each member 
-- trigger function for each data table
create or replace function public.gt_data_u_security_update_is_cleared_columns()
returns trigger
language plpgsql
as $$
declare 
base_schema_table_name text;
security_table_name text;
rec1 record;  
begin                                           
		security_table_name := replace(TG_TABLE_NAME, '_data', '_security');
		raise info 'security table: %', security_table_name;
		
        
        for rec1 in execute format('select id, sensitivity_clearance from public.people_data') loop
            
            raise info 'new.sensitivity: % | person_sensitivity_clearance: %', new.sensitivity, rec1.sensitivity_clearance;
            
            if (new.sensitivity = 'Medium' and rec1.sensitivity_clearance = 'Low') or 
            (new.sensitivity = 'High' and (rec1.sensitivity_clearance = 'Medium' or rec1.sensitivity_clearance = 'Low')) then 

                execute format('update ' || TG_TABLE_SCHEMA || '.%I set __is_cleared = false where __person_id = '|| rec1.id || ' and '|| ' __id = '|| old.id, security_table_name);
                -- get id reference from the data table
        
            end if;    

             
         
        end loop; 
		return null;
end; $$;

CREATE OR REPLACE FUNCTION public.create_data_sensitivity_triggers(p_schema_name text)
RETURNS VOID
LANGUAGE PLPGSQL
AS $$
declare 
	 rec1 record;
	 update_trigger_name text;
   base_schema_table_name text; 
begin
   

	for rec1 in (SELECT table_name FROM information_schema.tables
				WHERE table_schema = p_schema_name and table_name like '%_data'
				ORDER BY table_name) loop 
            
        perform column_name 
        FROM information_schema.columns 
        WHERE table_schema = p_schema_name and table_name = rec1.table_name and column_name='sensitivity';

        base_schema_table_name := p_schema_name || '.' || rec1.table_name;
        update_trigger_name := quote_ident(rec1.table_name||'_sensitivity_update_trigger');
        if found then 
            -- UPDATE TRIGGER
            execute format('DROP TRIGGER IF EXISTS '|| update_trigger_name || ' ON ' ||base_schema_table_name);
            execute format('CREATE TRIGGER ' || update_trigger_name
            || ' AFTER UPDATE
            ON ' || base_schema_table_name || 
            ' FOR EACH ROW
            EXECUTE PROCEDURE public.gt_data_u_security_update_is_cleared_columns()'); 

        end if;

	END loop;
	raise info 'DONE';
end; $$;

select public.create_data_triggers('public');
select public.create_data_triggers('sc');