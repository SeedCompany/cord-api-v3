insert into public.people_data("id","public_first_name") values(generate_series(0,10), 'person'|| 
generate_series(0,10));

select * from public.people_data;

insert into public.people_security("__person_id", "__id", "__is_cleared") 
select p1.id, p2.id, 'true' as boolean from public.people_data as p1 
cross join public.people_data as p2 
where p1.id <> p2.id; 

insert into public.organizations_data("id", "name") values(generate_series(0,10), 
'org'||generate_series(0,10));

select * from public.organizations_data;

insert into public.organizations_security("__person_id", "__id", "__is_cleared") 
select p.id, d.id, 'true' as boolean 
from public.people_data as p cross join public.organizations_data as d;

