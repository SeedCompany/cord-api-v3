create or replace function public.gt_security_iud_refresh_mv()
returns trigger
language plpgsql
as $$
declare 
	rec1 record;
    rec2 record;
    materialized_view_name text;
    materialized_view_string text;
    security_table_column text;
begin
    materialized_view_name := replace(TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, '_security', '_materialized_view');
    execute format('refresh materialized view ' || materialized_view_name); 
    -- execute format('refresh materialized view concurrently ' || materialized_view_name); 
	return new;
end; $$;




CREATE OR REPLACE FUNCTION public.create_refresh_mv_triggers(p_schema_name text)
RETURNS VOID
LANGUAGE PLPGSQL
AS $$
declare 
	rec1 record;
	insert_trigger_name text;
    update_trigger_name text;
    delete_trigger_name text;
    security_schema_table_name text; 
begin


	for rec1 in (SELECT table_name FROM information_schema.tables
				WHERE table_schema = p_schema_name and table_name like '%_security'
				ORDER BY table_name) loop 

        security_schema_table_name := p_schema_name || '.' || rec1.table_name;
        insert_trigger_name := quote_ident(rec1.table_name||'_i_refresh_mv');
        update_trigger_name := quote_ident(rec1.table_name||'_u_refresh_mv');
        delete_trigger_name := quote_ident(rec1.table_name||'_d_refresh_mv');
        raise info 'refresh.mv security_schema_table_name: %', security_schema_table_name;

        -- INSERT TRIGGER
        execute format('DROP TRIGGER IF EXISTS '|| insert_trigger_name || ' ON ' ||security_schema_table_name);
        execute format('CREATE TRIGGER ' || insert_trigger_name
        || ' AFTER INSERT
        ON ' || security_schema_table_name || 
        ' FOR EACH ROW
        EXECUTE PROCEDURE public.gt_security_iud_refresh_mv()'); 
        -- UPDATE TRIGGER
        execute format('DROP TRIGGER IF EXISTS '|| update_trigger_name || ' ON ' ||security_schema_table_name);
        execute format('CREATE TRIGGER ' || update_trigger_name
        || ' AFTER UPDATE
        ON ' || security_schema_table_name || 
        ' FOR EACH ROW
        EXECUTE PROCEDURE public.gt_security_iud_refresh_mv()'); 
        -- DELETE TRIGGER
        execute format('DROP TRIGGER IF EXISTS '|| delete_trigger_name || ' ON ' ||security_schema_table_name);
        execute format('CREATE TRIGGER ' || delete_trigger_name
        || ' AFTER DELETE
        ON ' || security_schema_table_name || 
        ' FOR EACH ROW
        EXECUTE PROCEDURE public.gt_security_iud_refresh_mv()'); 

	END loop;
	raise info 'DONE';
end; $$;

select public.create_refresh_mv_triggers('public');
select public.create_refresh_mv_triggers('sc');