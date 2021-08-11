create or replace function public.gt_security_i_data_and_people_get_is_cleared()
returns trigger
language plpgsql
as $$
declare 
    rec1 record;
    security_schema_table_name text;
    base_schema_table_name text;
    base_table_name text; 
    data_table_row_sensitivity public.sensitivity;
    person_sensitivity_clearance public.sensitivity;
begin

    base_table_name := replace(TG_TABLE_NAME,'_security', '_data');

    -- only proceed ahead if the data table has a column for sensitivity
    perform column_name 
    FROM information_schema.columns 
    WHERE table_schema = TG_TABLE_SCHEMA and table_name = base_table_name and column_name='sensitivity';

    if found then 
        base_schema_table_name := TG_TABLE_SCHEMA || '.' || base_table_name;
        security_schema_table_name := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;

        select sensitivity_clearance into person_sensitivity_clearance from public.people_data where id = new.__person_id;
        execute format('select sensitivity from ' || base_schema_table_name || ' where id = ' || new.__id) into data_table_row_sensitivity;

        raise info 'data_table_row_sensitivity: % | person_sensitivity_clearance: %', data_table_row_sensitivity, person_sensitivity_clearance;
        
        if (data_table_row_sensitivity = 'Medium' and person_sensitivity_clearance = 'Low') or 
        (data_table_row_sensitivity = 'High' and (person_sensitivity_clearance = 'Medium' or person_sensitivity_clearance = 'Low')) then 

            execute format('update ' || TG_TABLE_SCHEMA || '.%I set __is_cleared = false where __person_id = '|| new.__person_id || ' and '|| ' __id = '|| new.__id, TG_TABLE_NAME);
    

        end if;    
    end if; 
    return null;   
end; $$;

CREATE OR REPLACE FUNCTION public.create_security_sensitivity_triggers(p_schema_name text)
RETURNS VOID
LANGUAGE PLPGSQL
AS $$
declare 
	 rec1 record;
	 insert_trigger_name text;
   security_schema_table_name text; 
begin


	for rec1 in (SELECT table_name FROM information_schema.tables
				WHERE table_schema = p_schema_name and table_name like '%_security'
				ORDER BY table_name) loop 

      security_schema_table_name := p_schema_name || '.' || rec1.table_name;
      insert_trigger_name := quote_ident(rec1.table_name||'_sensitivity_trigger');


        -- INSERT TRIGGER
        execute format('DROP TRIGGER IF EXISTS '|| insert_trigger_name || ' ON ' ||security_schema_table_name);
        execute format('CREATE TRIGGER ' || insert_trigger_name
        || ' AFTER INSERT
        ON ' || security_schema_table_name || 
        ' FOR EACH ROW
        EXECUTE PROCEDURE public.gt_security_i_data_and_people_get_is_cleared()'); 


	END loop;
	raise info 'DONE';
end; $$;

select public.create_security_sensitivity_triggers('public');
select public.create_security_sensitivity_triggers('sc');