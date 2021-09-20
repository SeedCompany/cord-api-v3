-- will take in __id, __person_id, pTableSchema, pTableName
create or replace function public.gt_security_i_granters_get_access_level()
returns trigger
language plpgsql 
as $$
declare
rec1 record; 
base_table_name text;
base_schema_table text;
base_schema_table_name text;
global_access_level public.access_level;
project_access_level public.access_level;
final_access_level public.access_level;
security_column_name text;
begin

    base_table_name := replace(TG_TABLE_NAME, '_security', '_data');
    base_schema_table_name := TG_TABLE_SCHEMA || '.' || base_table_name;

    -- find access level for every column of the newly inserted record

    for rec1 in (select cast(column_name as text) from information_schema.columns where table_schema = TG_TABLE_SCHEMA and table_name = base_table_name) loop 
        
        select public.get_global_access_level( new.__person_id, base_schema_table_name , rec1.column_name) into global_access_level;
               

        if base_schema_table_name = 'public.locations_data' or base_schema_table_name = 'public.organizations_data' then
            select public.get_project_access_level(new.__id, new.__person_id 
            , base_schema_table_name, rec1.column_name) into project_access_level;
        end if;

        if project_access_level = 'Write' then 
            final_access_level := 'Write';
        elsif project_access_level = 'Read' and global_access_level != 'Write' then
            final_access_level := 'Read';
        else 
            final_access_level := global_access_level;
        end if;

        raise info 'refresh fn global_access_level: % | project_access_level: % | final_access_level: %', global_access_level, project_access_level, final_access_level;
        

        if final_access_level is not null then 
            security_column_name := '_' || rec1.column_name;
            execute format('update %I.%I set '||security_column_name|| ' = ' 
                || quote_literal(final_access_level) || ' where __id = '|| new.__id  
                || ' and  __person_id = ' ||  new.__person_id, TG_TABLE_SCHEMA, TG_TABLE_NAME);
        end if;


    end loop; 
    return new;
end;$$;

CREATE OR REPLACE FUNCTION public.create_security_triggers(p_schema_name text)
RETURNS VOID
LANGUAGE PLPGSQL
AS $$
declare 
	 rec1 record;
	 insert_trigger_name text;
   base_schema_table_name text; 
begin


	for rec1 in (SELECT table_name FROM information_schema.tables
				WHERE table_schema = p_schema_name and table_name like '%_security'
				ORDER BY table_name) loop 

      base_schema_table_name := p_schema_name || '.' || rec1.table_name;
      insert_trigger_name := quote_ident(rec1.table_name||'_grant_insert_trigger');

        -- INSERT TRIGGER
        execute format('DROP TRIGGER IF EXISTS '|| insert_trigger_name || ' ON ' ||base_schema_table_name);
        execute format('CREATE TRIGGER ' || insert_trigger_name
        || ' AFTER INSERT
        ON ' || base_schema_table_name || 
        ' FOR EACH ROW
        EXECUTE PROCEDURE public.gt_security_i_granters_get_access_level()'); 


	END loop;
	raise info 'DONE';
end; $$;

select public.create_security_triggers('public');
select public.create_security_triggers('sc');