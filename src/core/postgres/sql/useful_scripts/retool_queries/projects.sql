-- MODIFICATIONS: 
update public.projects_data set primary_location  = 1;
refresh materialized view public.projects_materialized_view;
-- BUDGETS
insert into sc.directories_data(id, name) values(0,'dir0');
insert into sc.files_data(id,directory,name ) values(0,0,'file0');
insert into sc.file_versions_data(id,category,name,mime_type, file,file_url) values(0,'budgets','file_ver0', 'A', 0, 'home/file0');
insert into sc.budgets_data(base64,project, universal_template) values('lalala', 0 ,0);
insert into sc.partnerships_data(id,base64,project,partner,agreement) values(0,'defaultPartnership',0,'defaultOrg',0);
insert into sc.budget_records_data(base64,budget,active,fiscal_year,partnership,amount ) values('defaultBudgetRecord',1,true, 2021,'defaultPartnership', 2500);
-- POSTS
insert into sc.posts_directory(id) values(0);
update sc.projects_data set posts_directory = 0; 
refresh materialized view sc.projects_materialized_view;
insert into sc.posts_data(id,directory,type,shareability,body) values(0,0,'Note','Internal', 'Note0');
-- FINANCIAL REPORTS
-- NARRATIVE REPORTS
-- TEAM MEMBERS
-- PARTNERSHIPS
-- CHANGE REQS
-- FILES    
-- LANGUAGE ENGAGEMENTS



-- RETOOL QUERIES
-- PINNED PROJECTS
-- PROJECT PARENT TABLE - REFACTOR TO USE CTEs
select pmv.name,pmv.id,smv.department,pmv.sensitivity,smv.active, smv.change_to_plan,lmv.name, 
(select count(*) from sc.language_engagements_materialized_view where project = pmv.id) as 
language_engagements from public.projects_materialized_view pmv inner join 
sc.projects_materialized_view smv on pmv.id = smv.project inner join (select __person_id,id,name from 
public.locations_materialized_view) as lmv on lmv.id = pmv.primary_location
where pmv.__person_id = 1 and smv.__person_id = 1 and lmv.__person_id = 1;

-- BUDGET
select sum(amount) from records_materialized_view brmv where brmv.budget in (select id from 
sc.budgets_materialized_view bmv where bmv.project = 0) and brmv.__person_id = 1;
select partnership, fiscal_year,amount  from sc.budget_records_materialized_view brmv where brmv.budget in (select id from 
sc.budgets_materialized_view bmv where bmv.project = 0) and brmv.__person_id = 1;

-- FILES
-- FINANCIAL REPORTS
-- NARRATIVE REPORTS
-- TEAM MEMBERS
-- PARTNERSHIPS
-- CHANGE REQS
-- LANGUAGE ENGAGEMENTS
-- POSTS
select type,shareability,pmv.created_at, pmv.created_by, ppmv.public_first_name || ' ' || ppmv.public_last_name as full_name from 
sc.posts_materialized_view pmv inner join  public.people_materialized_view ppmv on pmv.created_by = 
ppmv.id where directory = (select posts_directory from sc.projects_materialized_view where __person_id = 0 and __id = 1) and pmv.__person_id = 0;

