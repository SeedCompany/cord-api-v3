-- create or replace function migrate_language_codes_data()
-- returns INT 
-- language plpgsql
-- as $$
-- declare 
-- 	responseCode INT;
-- begin
-- 	set schema 'public';
-- 	create table if not exists sil_language_codes (
-- 		lang_id char(3) not null,
-- 		country_id char(2) not null,
-- 		lang_status char(1) not null,
-- 		name varchar(75) not null
-- 	);
-- 	perform * from sil_language_codes 
-- 	where lang_id = 'aaa';
-- 	if not found then
-- 		copy sil_language_codes 
-- 		from '/home/vivek/savor-rnd/src/apiMain/kotlin/core/data/dumps/LanguageCodes.tab' delimiter '	';
-- 		responseCode := 0;
-- 	else 
-- 		responseCode := 1;
-- 	end if;
-- 	return responseCode;
-- end; $$





