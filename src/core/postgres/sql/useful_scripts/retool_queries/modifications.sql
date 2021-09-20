-- projects_parent : 
-- update public.projects_data set primary_location  = 1;
-- projects_budgets
-- insert into sc.files_data(id,directory,name ) values(0,0,'file0');
-- insert into sc.file_versions_data(id,category,name,mime_type, file,file_url) values(0,'budgets','file_ver0', 'A', 0, 'home/file0');
-- insert into sc.budgets_data(base64,project, universal_template) values('lalala', 0 ,0);
-- insert into sc.partners_data(id, active,point_of_contact,organization, pmc_entity_code)values(0,true,0,'defaultOrg', 'default_code');
-- insert into sc.partnerships_data(id,base64,project,partner,agreement) values(0,'defaultPartnership',0,'defaultOrg',0);
-- insert into sc.budget_records_data(base64,budget,active,fiscal_year,partnership,amount ) values('defaultBudgetRecord',1,true, 2021,'defaultPartnership', 2500);
-- -- projects_posts
-- insert into sc.posts_directory(id) values(0);
-- update sc.projects_data set posts_directory = 0; 
-- refresh materialized view sc.projects_materialized_view;
-- insert into sc.posts_data(id,directory,type,shareability,body) values(0,0,'Note','Internal', 'Note0');
-- projects_reports
insert into sc.periodic_reports_directory(id) values(0);
insert into sc.periodic_reports_data(id, directory, start_at,end_at,type,reportFile) values 
(0,0,'2020-01-01', '2020-12-12','Narrative',0);
-- insert into sc.files_data(id,directory,name) values (1,0, 'file1');
insert into sc.periodic_reports_data(id, directory, start_at, end_at, type,reportFile) values 
(1,0,'2020-01-01', '2020-12-12', 'Financial', 1);
-- projects_team_members
insert into project_memberships(project,person) values (0,0);

-- languages_parent
insert into sil.table_of_languages(id, iso_639, language_name) values (0, 'txn', 'texan');
insert into sc.languages_data(id,display_name,name,sensitivity) values(0, 'texan', 'texan','Medium');
-- languages_scripture
insert into public.scripture_references(id, book_start, book_end, chapter_start, chapter_end, verse_start, verse_end) values(0, 'Genesis', 'Genesis', 1, 10, 1, 10);

-- languages_locations
insert into sc.language_locations_data(ethnologue,location) values(0,1);

-- languages_projects
insert into sc.language_engagements_data(id,base64,change_to_plan,ethnologue,periodic_reports_directory, pnp_file,project) values(0, 'lang123',0,0,0,0,0);

