-- NOTE: using pg_catalog instead of information_schema might speed up the function

-- NOTE: if function needs to be extended for multi-dimensional array datatypes for columns - https://stackoverflow.com/questions/39436189/how-to-get-the-dimensionality-of-an-array-column
-- _data people_data -> people_history, people_security 
-- locations_data -> id,name, address, phone
-- locations_security -> __id, __person_id, _id, _name, _address, _phone


create or replace function public.create_security_history_tables(p_schema_name text)
returns text
language plpgsql
as $$
declare 
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
        history_table_name := replace(rec1.table_name, '_data', '_history');
        raise info 'history_table_name: % | security_table_name: %', history_table_name, security_table_name;

        -- public.locations_security, public.locations_history
        base_schema_table_name := p_schema_name || '.' || rec1.table_name;
        security_schema_table_name := replace(base_schema_table_name, '_data', '_security');
        history_schema_table_name := replace(base_schema_table_name, '_data', '_history');
        raise info 'history_schema_table_name: % | security_schema_table_name: %', history_schema_table_name, security_schema_table_name;

        -- HISTORY TABLE CREATION
        execute format('create table if not exists '|| history_schema_table_name || ' ( _history_id serial primary key, 
        _history_created_at timestamp not null default CURRENT_TIMESTAMP)'); 

        -- SECURITY TABLE CREATION
        execute format('create table if not exists '|| security_schema_table_name || ' ( __person_id int not null, __id int not null, __is_cleared boolean, foreign key(__person_id) references public.people_data(id), foreign key (__id) references ' ||  base_schema_table_name || '(id))' );


        -- UPDATE BOTH SECURITY AND HISTORY TABLE (IDEMPOTENT MANNER)
         for rec2 in (select column_name,case 
        			  when (data_type = 'USER-DEFINED') then 'public.' || udt_name
                      when (data_type = 'ARRAY')
                      then  substr(udt_name, 2, length(udt_name)-1) || '[]' 
        			else data_type 
    				end as data_type from information_schema.columns
        			where table_schema = p_schema_name and table_name = rec1.table_name) loop
		raise info 'col-name: % | data-type: %', rec2.column_name, rec2.data_type;

            select column_name from information_schema.columns into existing_column where table_schema = p_schema_name
            and table_name = history_table_name and column_name = rec2.column_name ;

            if not found then
				
				status := 'history table updated';
                execute format('alter table ' || history_schema_table_name || ' add column ' || rec2.column_name || ' ' ||
                rec2.data_type);

            end if;


			security_table_column := '_' || rec2.column_name;

            select column_name from information_schema.columns into existing_column where table_schema = p_schema_name and table_name = security_table_name and column_name = security_table_column ;

            if not found then 
				
				status := 'security table updated';
                execute format('alter table '|| security_schema_table_name || ' add column '|| security_table_column || ' public.access_level');
            
            end if;

        end loop;

	end loop;
	raise info 'DONE';
	return status;
end; $$;


select public.create_security_history_tables('public');
select public.create_security_history_tables('sc');
