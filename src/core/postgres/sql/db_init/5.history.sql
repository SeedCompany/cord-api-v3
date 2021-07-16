CREATE OR REPLACE FUNCTION public.gt_data_iud_history_i()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
declare 
base_schema_table_name text;
history_schema_table_name text;
rec1 record;
col_name text;
last_id int;
begin
  base_schema_table_name := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;
  history_schema_table_name := replace(base_schema_table_name, '_data', '_history');

  raise info '%', base_schema_table_name; 
	execute format('insert into '|| history_schema_table_name || '(_history_id) values( default
	 ) returning _history_id') into last_id;

	for rec1 in (select column_name from information_schema.columns where table_schema = TG_TABLE_SCHEMA and  table_name = TG_TABLE_NAME) loop 
    raise info '%', rec1;
    raise info '%', rec1.column_name;
    col_name := quote_ident(rec1.column_name);
      execute format('update '|| history_schema_table_name || ' set ' || quote_ident(rec1.column_name) || ' = $1.' || col_name ||' where _history_id = '|| last_id) using new ;
	END loop;
	raise info 'DONE';
	RETURN NEW;
end; $$;


CREATE OR REPLACE FUNCTION create_history_triggers_fn(p_schema_name text)
RETURNS VOID
LANGUAGE PLPGSQL
AS $$
declare 
	 rec1 record;
	 insert_trigger_name text;
	 update_trigger_name text;
	 base_schema_table_name text;
begin
	for rec1 in (SELECT table_name
	FROM information_schema.tables
	WHERE table_schema = p_schema_name and table_name like '%_data'
	ORDER BY table_name) loop 
	-- FINDING ALL TABLES THAT HAVE A HISTORY TABLE AND LOOPING OVER THEM
	base_schema_table_name = p_schema_name || '.' || rec1.table_name;
	insert_trigger_name := quote_ident(rec1.table_name||'_history_insert_trigger');
	update_trigger_name := quote_ident(rec1.table_name||'_history_update_trigger');
	raise info '%', base_schema_table_name;
	-- INSERT TRIGGER
	execute format('DROP TRIGGER IF EXISTS '|| insert_trigger_name || ' ON ' ||base_schema_table_name);
	execute format('CREATE TRIGGER ' || insert_trigger_name
  	|| ' AFTER INSERT
  	ON ' || base_schema_table_name || 
  	' FOR EACH ROW
  	EXECUTE PROCEDURE public.gt_data_iud_history_i()'); 
	--   UPDATE TRIGGER
	execute format('DROP TRIGGER IF EXISTS ' || update_trigger_name || ' ON ' || base_schema_table_name);
	execute format('CREATE TRIGGER ' || update_trigger_name
  	|| ' AFTER UPDATE
  	ON ' || base_schema_table_name || 
  	' FOR EACH ROW
  	EXECUTE PROCEDURE public.gt_data_iud_history_i()'); 

	END loop;
	raise info 'DONE';
end; $$;

select create_history_triggers_fn('public');
select create_history_triggers_fn('sc');
