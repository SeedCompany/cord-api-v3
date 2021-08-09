-- you need to remove the header of the tsv files 

create or replace function migrate_country_codes_data()
returns INT 
language plpgsql
as $$
declare 
	responseCode INT;
begin
	perform * from sil.country_codes 
	where country = 'AA';
	if not found then
		copy sil.country_codes 
		from '/home/questionreality/cord-api-v3/src/core/postgres/sql/tab_data/CountryCodes.tab' delimiter '	';
		responseCode := 0;
	else 
		responseCode := 1;
	end if;
	return responseCode;
end; $$;

select migrate_country_codes_data();