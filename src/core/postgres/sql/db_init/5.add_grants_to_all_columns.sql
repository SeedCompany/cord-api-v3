
create or replace procedure public.add_grants_to_table(pTableName text, pRoleName text)
language plpgsql
as $$
declare 
pHstore hstore;
rec1 record;
role_id int;
begin
-- 	pHstore := '"global_role"=>"0","table_name"=>'||quote_ident(pTableName) 
-- 	||',"access_level"=>"Write"';

	select id from public.global_roles_data into role_id where name = pRoleName;  
	for rec1 in select column_name from information_schema.columns 
	where table_schema = split_part(pTableName, '.',1) 
	and table_name = split_part(pTableName, '.', 2) loop
-- 		pHstore := pHstore || ',' || '"column_name"=>'|| 
-- 		quote_ident(rec1.column_name);
		pHstore := hstore(ARRAY['global_role','access_level', 
							'table_name', 'column_name'], ARRAY[role_id::text,'Write', 
							pTableName, rec1.column_name]);
		raise notice '%', pHstore;
		execute format('call public.create(0,$1,$2,$3::public.toggle_security,
		$4::public.toggle_mv,$5::public.toggle_history,$6::public.toggle_granters,0)') 
		using 'public.global_role_column_grants', pHstore,'UpdateAccessLevelAndIsClearedSecurity', 'RefreshMVConcurrently', 'History','RefreshSecurityTablesAndMVConcurrently';
	end loop;
	raise notice '%', pHstore;
	
end; $$;