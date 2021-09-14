create or replace procedure public.add_grants_to_table(pTableName text)
language plpgsql
as $$
declare 
pHstore hstore;
rec1 record;
begin
-- 	pHstore := '"global_role"=>"0","table_name"=>'||quote_ident(pTableName) 
-- 	||',"access_level"=>"Write"';
	for rec1 in select column_name from information_schema.columns 
	where table_schema = split_part(pTableName, '.',1) 
	and table_name = split_part(pTableName, '.', 2) loop
-- 		pHstore := pHstore || ',' || '"column_name"=>'|| 
-- 		quote_ident(rec1.column_name);
		pHstore := hstore(ARRAY['global_role','access_level', 
							'table_name', 'column_name'], ARRAY['0','Write', 
							pTableName, rec1.column_name]);
		raise notice '%', pHstore;
		execute format('call public.create(0,$1,$2,$3,$4,$5,$6,0)') 
	using 'public.global_role_column_grants', pHstore, 'UpdateAccessLevelAndIsClearedSecurity', 'RefreshMVConcurrently', 'History','RefreshSecurityTablesAndMVConcurrently';
	end loop;
	raise notice '%', pHstore;
	
end; $$;

