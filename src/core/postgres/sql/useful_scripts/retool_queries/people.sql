select public_first_name || ' '|| public_last_name as public_full_name from public.people_materialized_view where id is not null;

select count(DISTINCT id) from public.people_materialized_view;