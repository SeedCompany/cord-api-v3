-- ADDING DEFAULT TO EACH COLUMN OF EVERY SECURITY TABLE 


create or replace function public.alter_security_tables(p_schema_name text)
returns text
language plpgsql
as $$
declare 
    rec0 record;
	rec1 record;
    rec2 record;
    existing_column text;
    base_schema_table_name text;
    security_table_name text;
    history_table_name text;
    security_schema_table_name text;
    history_schema_table_name text;    
	security_table_column text;
	status text;
begin
	status := 'no change';

    -- FINDING ALL TABLES THAT NEED A HISTORY AND SECURITY TABLE AND LOOPING OVER THEM
    for rec1 in (select table_name
	from information_schema.tables
	where table_schema = p_schema_name and table_name like '%_data'
	order by table_name) loop 

        -- locations_security, locations_history, 
        security_table_name := replace(rec1.table_name, '_data', '_security');
        -- public.locations_security, public.locations_history
        base_schema_table_name := p_schema_name || '.' || rec1.table_name;
        security_schema_table_name := replace(base_schema_table_name, '_data', '_security');




        -- UPDATE BOTH SECURITY AND HISTORY TABLE (IDEMPOTENT MANNER)
         for rec2 in (select column_name from information_schema.columns
        			where table_schema = p_schema_name and table_name = rec1.table_name) loop

         


			security_table_column := '_' || rec2.column_name;

            select column_name from information_schema.columns into existing_column where table_schema = p_schema_name and table_name = security_table_name and column_name = security_table_column ;

            if found then 
				
				status := 'security table updated';
                execute format('alter table '|| security_schema_table_name || ' alter column '|| security_table_column || ' set default ''Write''');
            
            end if;

        end loop;

	end loop;
	raise info 'DONE';
	return status;
end; $$;


select public.alter_security_tables('public');
select public.alter_security_tables('sc');
