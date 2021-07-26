select email from users_materialized_view umv where umv.__person_id = 0;

select count(DISTINCT id) from public.people_materialized_view;
