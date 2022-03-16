-- NOTE: using pg_catalog instead of information_schema might speed up the function
-- NOTE: if function needs to be extended for multi-dimensional array datatypes for columns - https://stackoverflow.com/questions/39436189/how-to-get-the-dimensionality-of-an-array-column
create or replace procedure admin.create_peer_tables()
language plpgsql
as $$
declare
	rec0 record;
	rec1 record;
    rec2 record;
    peer_table_name text;
	status text;
begin
	-- GETTING ALL NON-SYSTEM SCHEMAS
    for rec0 in (select distinct table_schema from information_schema.tables where table_schema <> 'pg_catalog'
    and table_schema <> 'information_schema' ) loop

        -- FINDING ALL TABLES THAT NEED A HISTORY AND LOOPING OVER THEM
        for rec1 in (select table_name
        from information_schema.tables
        where table_schema = rec0.table_schema and table_name not similar to '%(_peer|_history)'
        order by table_name) loop

            peer_table_name := rec1.table_name || '_peer';
            raise info 'peer_table_name: % ', peer_table_name;

            -- HISTORY TABLE CREATION
            execute format('create table if not exists %I.%I ( _peer_id uuid not null references admin.peers(id),
            _row_id serial primary key)', rec0.table_schema,peer_table_name);

            -- UPDATE BOTH SECURITY AND HISTORY TABLE (IDEMPOTENT MANNER)
            for rec2 in (select column_name,case
                        when (data_type = 'USER-DEFINED') then udt_schema || '.' || udt_name
                        when (data_type = 'ARRAY') then  udt_schema || '.' || substr(udt_name, 2, length(udt_name)-1) || '[]'
                        when (data_type = 'character') then udt_schema || '.' || udt_name || '(' || character_maximum_length || ')'
                        when (data_type = 'character varying') then udt_schema || '.' || udt_name || '(' || character_maximum_length || ')'
                        else data_type
                        end as data_type from information_schema.columns
                        where table_schema = rec0.table_schema and table_name = rec1.table_name) loop
            raise info 'col-name: % | data-type: %', rec2.column_name, rec2.data_type;

                perform column_name from information_schema.columns where table_schema = rec0.table_schema
                and table_name = peer_table_name and column_name = rec2.column_name;

                if not found then

                    raise info 'peer table updated';
                    execute format('alter table ' || rec0.table_schema || '.' || peer_table_name || ' add column ' || rec2.column_name || ' ' || rec2.data_type);

                end if;

            end loop;
        end loop;
    end loop;
	raise info 'DONE';
end; $$;

call admin.create_peer_tables();
