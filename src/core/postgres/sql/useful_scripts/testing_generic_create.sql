select public.create(0, 'sc.partners_data', '"created_by"=>"0","organization"=>"lalala", "types"=>"[''A'', ''B'']", "point_of_contact"=>"0"');
select * from sc.partners_data;
select * from public.global_role_column_grants_data where table_name = 'public.locations_data';
select * from public.global_role_table_permissions_data;
insert into public.global_role_table_permissions_data(global_role, table_name, table_permission) values(0, 'sc.partners_data', 'Create');
select * from public.global_role_column_grants_data;
insert into public.global_role_column_grants_data(access_level, column_name, table_name, global_role) values('Write', 'created_by', 'sc.partners_data', 0);
insert into public.global_role_table_permissions_data(global_role,table_name, table_permission) values(0,'sc.partners_data', 'Create')
select * from public.locations_data;
insert into sc.organizations_data(id,base64, created_by, internal) values(0,'lalala', 0, 'internal_lalala');
insert into sc.partners_data(created_by,organization,types, point_of_contact) values(0,lalala::text, ARRAY['A']::public.partner_types[] ,0);