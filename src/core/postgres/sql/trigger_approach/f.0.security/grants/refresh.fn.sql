-- trigger function for projects_data,project_member_roles_data, project_role_column_grants_data, 
-- global_role_memberships, global_role_grants_data (on insert update or delete),
-- The great thing about this approach is we can use the same trigger function for insert,update,delete for all the tables 

create or replace function public.gt_granters_iud_security_update_grant_columns()
returns trigger
language plpgsql
as $$
declare 
security_schema_table text;
rec1 record;
rec2 record;
rec3 record;
global_access_level public.access_level;
project_access_level public.access_level;
-- change this to public.table_name after updating enum
base_schema_table_name text;
base_table_name text;
security_schema_table_name text; 
security_column_name text; 
final_access_level public.access_level;
begin 
    

    for rec1 in (select table_name from information_schema.tables where table_schema = TG_ARGV[0] and table_name like '%_security' order by table_name) loop 

        base_table_name := replace(rec1.table_name, '_security', '_data');

    raise info 'refresh fn rec1:  %,  base_table: %', rec1, base_table_name; 

       for rec2 in (select cast(column_name as text) from information_schema.columns
        			where table_schema = TG_ARGV[0] and table_name = base_table_name) loop
    
        raise info 'refresh fn rec2: %', rec2;
        security_schema_table_name := TG_ARGV[0] || '.' || rec1.table_name;
        base_schema_table_name := replace(security_schema_table_name, '_security', '_data');


                for rec3 in execute format('select __id, __person_id from '|| security_schema_table_name) loop
                raise info 'refresh fn rec3: %', rec3;

                    select public.get_global_access_level( rec3.__person_id, base_schema_table_name 
                    , rec2.column_name) into global_access_level;
               

                    if base_schema_table_name = 'public.locations_data' or base_schema_table_name = 'public.organizations_data' then
                        select public.get_project_access_level(rec3.__id, rec3.__person_id 
                        , base_schema_table_name, rec2.column_name) into project_access_level;
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
                        execute format('update ' || TG_ARGV[0] || '.%I set '||quote_ident(security_column_name)|| ' = ' 
                            || quote_literal(final_access_level) || ' where __id = '|| rec3.__id  
                            || ' and  __person_id = ' ||  rec3.__person_id, rec1.table_name );
                    end if;
                end loop;
        end loop;
    end loop;
    
	return null;
end; $$;

CREATE OR REPLACE FUNCTION public.create_refresh_triggers(p_schema_name text, p_table_name text)
RETURNS VOID
LANGUAGE PLPGSQL
AS $$
declare 
	 insert_trigger_name text;
	 update_trigger_name text;
	 delete_trigger_name text;
begin


	insert_trigger_name := quote_ident(p_table_name||'_refresh_insert_trigger');
	update_trigger_name := quote_ident(p_table_name||'_refresh_update_trigger');
	delete_trigger_name := quote_ident(p_table_name||'_refresh_delete_trigger');

	p_table_name := p_schema_name || '.' || p_table_name;
	execute format('DROP TRIGGER IF EXISTS '|| insert_trigger_name || ' ON ' ||p_table_name);
	execute format('DROP TRIGGER IF EXISTS '|| update_trigger_name || ' ON ' ||p_table_name);
	execute format('DROP TRIGGER IF EXISTS '|| delete_trigger_name || ' ON ' ||p_table_name);

	execute format('CREATE TRIGGER ' || insert_trigger_name
	|| ' AFTER INSERT ON ' || p_table_name || ' FOR EACH ROW EXECUTE PROCEDURE public.gt_granters_iud_security_update_grant_columns('|| p_schema_name || ')'); 

	execute format('CREATE TRIGGER ' || update_trigger_name
	|| ' AFTER update ON ' || p_table_name || ' FOR EACH ROW EXECUTE PROCEDURE public.gt_granters_iud_security_update_grant_columns('|| p_schema_name || ')'); 

	execute format('CREATE TRIGGER ' || delete_trigger_name
	|| ' AFTER delete ON ' || p_table_name || ' FOR EACH ROW EXECUTE PROCEDURE public.gt_granters_iud_security_update_grant_columns('|| p_schema_name || ')'); 


end; $$;



select public.create_refresh_triggers('public','project_member_roles_data');
select public.create_refresh_triggers('public', 'project_role_column_grants_data');
select public.create_refresh_triggers('public', 'global_role_column_grants');
select public.create_refresh_triggers('public', 'global_role_memberships');
select public.create_refresh_triggers('public', 'projects_data');

 