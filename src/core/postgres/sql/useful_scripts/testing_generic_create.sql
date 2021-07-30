select public.create(0,'public.people_data','
"id" => "1",
"public_first_name"=>"rhuan"
',1,1,0,0); 

select public.create(0,'public.organizations_data','
"id" => "1",
"name"=>"org1"
',1,1,0,0); 

select public.create(0,'public.global_roles_data','
"id" => "0",
"name"=>"default",
"org"=>"0"
',1,1,0,0); 

select public.create(0,'public.global_role_column_grants_data','
"id" => "0",
"column_name"=>"name",
"table_name"=>"public.organizations_data",
"access_level"=>"Write",
"global_role"=>"0"
',1,1,0,0); 

select public.create(0,'public.global_role_memberships_data','
"id" => "1",
"global_role"=>"0",
"person"=>"1"
',1,1,0,0);

