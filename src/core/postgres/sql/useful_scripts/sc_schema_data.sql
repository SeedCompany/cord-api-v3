update public.people_data set sensitivity_clearance = 'High';
insert into sc.change_to_plans_data(id, created_by) values(0,0);
insert into sc.projects_data(project,base64,active,created_by,department,name) 
values(1,'lalala', true, 0, 'dept1','proj1' );