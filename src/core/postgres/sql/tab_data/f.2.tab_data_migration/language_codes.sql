-- create or replace function migrate_language_codes_data()
-- returns INT 
-- language plpgsql
-- as $$
-- declare 
-- 	responseCode INT;
-- begin
-- 	perform * from sil.language_codes 
-- 	where lang = 'aaa';
-- 	if not found then
-- 		copy sil.language_codes 
-- 		from '/home/questionreality/cord-api-v3/src/core/postgres/sql/tab_data/LanguageCodes.tab' delimiter '	';
-- 		responseCode := 0;
-- 	else 
-- 		responseCode := 1;
-- 	end if;
-- 	return responseCode;
-- end; $$;

-- select migrate_language_codes_data();


