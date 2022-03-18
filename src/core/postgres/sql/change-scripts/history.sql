-- NOTE: using pg_catalog instead of information_schema might speed up the function
-- NOTE: if function needs to be extended for multi-dimensional array datatypes for columns - https://stackoverflow.com/questions/39436189/how-to-get-the-dimensionality-of-an-array-column

-- CREATING HISTORY TABLES IDEMPOTENTLY
create or replace procedure admin.create_history_tables()
language plpgsql
as $$
declare
	rec1 record;
	rec2 record;
	history_table_name text;
	status text;
begin
	-- FINDING ALL TABLES THAT NEED A HISTORY AND LOOPING OVER THEM
	for rec1 in (select table_schema, table_name
	from information_schema.tables
	where table_schema <> 'pg_catalog'
	and table_schema <> 'information_schema'
	and table_name not similar to '%(_peer|_history)'
	order by table_name) loop

		history_table_name := rec1.table_name || '_history';
		raise info 'history_table_name: % ', history_table_name;

		-- HISTORY TABLE CREATION
		execute format('create table if not exists %I.%I ( _history_id serial primary key,
		_history_created_at timestamp not null default CURRENT_TIMESTAMP, __event admin.history_event_type)', rec1.table_schema,history_table_name);

		-- UPDATE BOTH SECURITY AND HISTORY TABLE (IDEMPOTENT MANNER)
		for rec2 in (select column_name,case
					when (data_type = 'USER-DEFINED') then udt_schema || '.' || udt_name
					when (data_type = 'ARRAY') then  udt_schema || '.' || substr(udt_name, 2, length(udt_name)-1) || '[]'
					when (data_type = 'character') then udt_schema || '.' || udt_name || '(' || character_maximum_length || ')'
					when (data_type = 'character varying') then udt_schema || '.' || udt_name || '(' || character_maximum_length || ')'
					else data_type
					end as data_type from information_schema.columns
					where table_schema = rec1.table_schema and table_name = rec1.table_name) loop
		raise info 'col-name: % | data-type: %', rec2.column_name, rec2.data_type;

			perform column_name from information_schema.columns where table_schema = rec1.table_schema
			and table_name = history_table_name and column_name = rec2.column_name;

			if not found then

				raise info 'history table updated';
				execute format('alter table ' || rec1.table_schema || '.' || history_table_name || ' add column ' || rec2.column_name || ' ' || rec2.data_type);

			end if;

		end loop;
	end loop;
	raise info 'DONE';
end; $$;

-- GENERIC HISTORY TRIGGER
create or replace function admin.history_trigger()
returns trigger
language plpgsql
as $$
declare
base_table_name text;
history_table_name text;
history_row_id int;
rec1 record;
begin
	base_table_name := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;

	history_table_name := base_table_name || '_history';
	execute format('insert into '|| history_table_name || '(_history_id, __event) values (default,' || quote_literal(TG_OP)  ||') returning _history_id') into history_row_id;
	for rec1 in (select column_name from information_schema.columns where table_schema = TG_TABLE_SCHEMA and  table_name = TG_TABLE_NAME) loop
		if TG_OP != 'DELETE' then
			execute format('update '|| history_table_name || ' set ' || quote_ident(rec1.column_name) || ' = $1.' || quote_ident(rec1.column_name) ||' where _history_id = '|| history_row_id) using new ;
		else
			execute format('update '|| history_table_name || ' set ' || quote_ident(rec1.column_name) || ' = $1.' || quote_ident(rec1.column_name) ||' where _history_id = '|| history_row_id) using old;
		end if;
	end loop;
	return new;
end; $$;

-- CREATING HISTORY TRIGGERS FOR ALL BASE TABLES THAT NEED THEM
create or replace procedure admin.create_history_triggers()
language plpgsql
as $$
declare
insert_trigger text;
update_trigger text;
delete_trigger text;
base_table_name text;
rec1 record;
begin

	for rec1 in (select table_schema, table_name
	from information_schema.tables
	where table_schema <> 'pg_catalog'
	and table_schema <> 'information_schema'
	and table_type <> 'VIEW'
	and table_name not similar to '%(_peer|_history)'
	order by table_name) loop
		base_table_name := rec1.table_schema || '.' || rec1.table_name;
		insert_trigger := quote_ident(base_table_name || '_history_insert_trigger');
		update_trigger := quote_ident(base_table_name || '_history_update_trigger');
		delete_trigger := quote_ident(base_table_name || '_history_delete_trigger');
		-- insert trigger
		execute format('drop trigger if exists '|| insert_trigger || ' on ' ||base_table_name);
		execute format(
			'create trigger ' || insert_trigger
			|| ' after insert on ' || base_table_name
			|| ' for each row
			execute procedure admin.history_trigger()');
		-- update trigger
		execute format('drop trigger if exists ' || update_trigger || ' on ' || base_table_name);
		execute format(
			'create trigger ' || update_trigger
  			|| ' after update on ' || base_table_name ||
  			' for each row execute procedure admin.history_trigger()');
		-- delete trigger
		execute format('drop trigger if exists ' || delete_trigger || ' on ' || base_table_name);
		execute format(
			'create trigger ' || delete_trigger
  			|| ' after delete on ' || base_table_name ||
  			' for each row execute procedure admin.history_trigger()');
	end loop;
end; $$;


call admin.create_history_tables();
call admin.create_history_triggers();
