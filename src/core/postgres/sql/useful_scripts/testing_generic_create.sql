select public.create(0,'public.people_data','
"id" => "0",
"public_first_name"=>"vivek"
',2,1,1,1); 

select public.create(0,'public.organizations_data','
"id" => "0",
"name"=>"default"
',2,1,1,1); 

select * from public.organizations_data;
select * from public.organizations_security;

select public.create(0,'public.global_roles_data','
"id"=>"0",
"name"=>"default",
"org"=>"0"
',2,1,1,1); 

select public.create(0,'public.global_role_column_grants','
"id" => "0",
"column_name"=>"created_by",
"table_name"=>"public.organizations_data",
"access_level"=>"Write",
"global_role"=>"0"
',2,1,1,1); 

select public.create(0,'public.global_role_memberships','
"id" => "0",
"global_role"=>"0",
"person"=>"0"
',2,1,1,1);


select public.create(0,'public.people_data','
"id" => "1",
"public_first_name"=>"michael"
',2,1,1,1); 

select public.create(0,'public.organizations_data','
"id" => "1",
"name"=>"org1"
',2,1,1,1); 

select * from public.organizations_data;
select * from public.organizations_security;
select * from public.organizations_materialized_view;
-- because __is_cleared is false that's why they are all null 
update public.organizations_security set __is_cleared = true;
refresh materialized view public.organizations_materialized_view;