CREATE OR REPLACE FUNCTION public.history_fn(pTableName text, pToggleHistory int, pRecord hstore)
RETURNS integer
LANGUAGE PLPGSQL
AS $$
declare 
history_table_name text;
sql_string_keys text;
sql_string_values text;
rec1 record;
begin
    history_table_name := replace(pTableName, '_data', '_history');

    sql_string_keys := 'insert into '|| history_table_name || '(';
    sql_string_values := ') values (';
    for rec1 in (select skeys(pRecord), svals(pRecord)) loop 
        sql_string_keys := sql_string_keys || rec1.skeys || ',';
    
        select data_type, udt_name into column_data_type, column_udt_name from information_schema.columns where table_schema = split_part(pTableName, '.',1) and table_name = split_part(pTableName, '.', 2) and column_name = rec3.skeys; 

        if column_data_type = 'ARRAY'then 
            sql_string_values := sql_string_values || 'ARRAY' || rec3.svals ||'::' ||  'public.' || substr(column_udt_name, 2, length(column_udt_name)-1) || '[],';
        else 
            sql_string_values := sql_string_values || quote_literal(rec3.svals) || ',';
        end if;
    end loop;
	execute format(sql_string_keys||sql_string_values);
    
    
	raise info 'DONE';
	RETURN 0;
end; $$;