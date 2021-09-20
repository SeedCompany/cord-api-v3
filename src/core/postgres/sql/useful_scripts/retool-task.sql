select * from public.language_ex_data;
select * from public.language_ex_security; 
select * from public.language_ex_materialized_view where __person_id = 2;

where __person_id = {{}};
select * from public.people_data;
select * from public.global_role_column_grants;
select * from public.global_role_memberships;
select * from public.global_roles_data;
alter type table_name add value 'public.language_ex_data';
call public.add_grants_to_table('public.language_ex_data', 'Administrator');
call public.add_user_to_role(2,0);
ALTER TABLE public.global_role_column_grants 
ALTER COLUMN column_name TYPE text;





call public.create(0,'public.language_ex_data',
				   '"lang_code"=>"ENG21"',
				'UpdateAccessLevelAndIsClearedSecurity','RefreshMVConcurrently', 
				'History',  'RefreshSecurityTablesAndMVConcurrently', 0);



