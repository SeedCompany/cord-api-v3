create or replace procedure public.granters_fn(pToggleGranters public.toggle_granters)
language plpgsql
as $$
declare 
security_schema_table text;
rec1 record;
rec2 record;
rec3 record;
rec4 record;
global_access_level public.access_level;
project_access_level public.access_level;
-- change this to public.table_name after updating enum
base_table_name text;
security_table_name text; 
security_column_name text; 
final_access_level public.access_level;
materialized_view_name text;
begin 
    
    if pToggleGranters = 'NoRefresh' then 
     return;
    else 
        for rec1 in (select table_name,table_schema from information_schema.tables where (table_schema = 'public' or table_schema = 'sc') and table_name like '%_security' order by table_name) loop 

            security_table_name := rec1.table_schema || '.' || rec1.table_name;
            base_table_name := replace(security_table_name, '_security', '_data');

            raise info 'refresh fn  security_table: %',security_table_name; 

        for rec2 in (select cast(column_name as text) from information_schema.columns
                        where table_schema = split_part(base_table_name, '.',1) and table_name = split_part(base_table_name, '.',2)) loop
        
            raise info 'refresh fn rec2: %', rec2;


                    for rec3 in execute format('select __id, __person_id from %I.%I', split_part(security_table_name, '.',1), split_part(security_table_name,'.',2)) loop
                    raise info 'refresh fn rec3: %', rec3;

                        select public.get_global_access_level( rec3.__person_id, base_table_name 
                        , rec2.column_name) into global_access_level;
                

                        if base_table_name = 'public.locations_data' or base_table_name = 'public.organizations_data' then
                            select public.get_project_access_level(rec3.__id, rec3.__person_id 
                            , base_table_name, rec2.column_name) into project_access_level;
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
                            security_column_name := '_' || rec2.column_name;
                            execute format('update  %I.%I set %I = ' 
                                || quote_literal(final_access_level) || ' where __id = '|| rec3.__id  
                                || ' and  __person_id = ' ||  rec3.__person_id, rec1.table_schema,rec1.table_name,security_column_name);
                        end if;
                    end loop;
            end loop;
            materialized_view_name := replace(security_table_name, '_security', '_materialized_view');
            if pToggleGranters = 'RefreshSecurityTablesAndMV' then 
                execute format('refresh materialized view %I.%I', split_part(materialized_view_name, '.', 1), split_part(materialized_view_name, '.', 2));
            elsif pToggleGranters = 'RefreshSecurityTablesAndMVConcurrently' then
                execute format('refresh materialized view concurrently %I.%I', split_part(materialized_view_name, '.', 1), split_part(materialized_view_name, '.', 2));
            end if;
        end loop;
    end if;
    return;
end; $$;

