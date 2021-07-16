create or replace function migrate_language_index_data()
returns INT 
language plpgsql
as $$
declare 
	responseCode INT;
begin
	perform * from sil.language_index 
	where lang = 'aaa';
	if not found then
		copy sil.language_index 
		from '/home/questionreality/cord-api-v3/src/core/postgres/sql/tab_data/LanguageIndex.tab' delimiter '	';
		responseCode := 0;
	else 
		responseCode := 1;
	end if;
	return responseCode;
end; $$;

select migrate_language_index_data();