-- NOTE: using pg_catalog instead of information_schema might speed up the function

-- NOTE: if function needs to be extended for multi-dimensional array datatypes for columns - https://stackoverflow.com/questions/39436189/how-to-get-the-dimensionality-of-an-array-column

create or replace function public.create_materialized_views(p_schema_name text)
returns int
language plpgsql
as $$
declare 
	rec1 record;
    rec2 record;
    materialized_view_name text;
    materialized_view_string text;
    base_schema_table_name text;
    security_schema_table_name text; 
    security_table_column text;
begin
    -- FINDING ALL TABLES THAT NEED A MATERIALIZED VIEW AND LOOPING OVER THEM
    for rec1 in (select table_name
	from information_schema.tables
	where table_schema = p_schema_name and table_name like '%_data'
	order by table_name) loop 
		raise info 'table_name: %', rec1.table_name;
        materialized_view_name := replace(p_schema_name || '.' || rec1.table_name, '_data', '_materialized_view');
        materialized_view_string := 'create materialized view if not exists ' || materialized_view_name || ' as select __person_id, __id'; 

        base_schema_table_name := p_schema_name || '.' || rec1.table_name;
        security_schema_table_name := replace(base_schema_table_name, '_data', '_security');


        -- UPDATE MATERIALIZED VIEW STRING
        for rec2 in (select column_name from information_schema.columns
        			where table_schema = p_schema_name and table_name = rec1.table_name) loop
		raise info 'col-name: %', rec2.column_name;

        security_table_column := '_' || rec2.column_name;
        materialized_view_string := materialized_view_string || ',case when __is_cleared = true and (' || security_table_column || ' is not null ) then ' || rec2.column_name || ' end "' || rec2.column_name|| '"';
            

        end loop;
        -- join on __person_id too?
        materialized_view_string := materialized_view_string || ' from '|| security_schema_table_name || ' join ' || base_schema_table_name || ' on ' || security_schema_table_name || '.__id = ' || base_schema_table_name || '.id;';

        execute format(materialized_view_string);
        -- https://stackoverflow.com/questions/41803781/refresh-materialized-views-with-concurrency/41804361
        execute format('CREATE UNIQUE INDEX ON ' || materialized_view_name || '(__id,__person_id)');

	end loop;
	raise info 'DONE';
	return 0;
end; $$;


select public.create_materialized_views('public');
select public.create_materialized_views('sc');