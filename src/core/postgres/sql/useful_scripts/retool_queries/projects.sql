-- PINNED PROJECTS
-- PROJECT PARENT TABLE - REFACTOR TO USE CTEs
select pmv.name,pmv.id,smv.department,pmv.sensitivity,smv.active, smv.change_to_plan,lmv.name, 
(select count(*) from sc.language_engagements_materialized_view where project = pmv.id) as 
language_engagements from public.projects_materialized_view pmv inner join 
sc.projects_materialized_view smv on pmv.id = smv.project inner join (select __person_id,id,name from 
public.locations_materialized_view) as lmv on lmv.id = pmv.primary_location
where pmv.__person_id = 1 and smv.__person_id = 1 and lmv.__person_id = 1;

-- BUDGET
select sum(amount) from sc.budget_records_materialized_view brmv where brmv.budget in (select id from 
sc.budgets_materialized_view bmv where bmv.project = 0) and brmv.__person_id = 1;
select partnership, fiscal_year,amount  from sc.budget_records_materialized_view brmv where brmv.budget in (select id from 
sc.budgets_materialized_view bmv where bmv.project = 0) and brmv.__person_id = 1;

-- FILES
select name,created_by, created_at from sc.directories_materialized_view dmv where dmv.parent = (select root_directory from sc.projects_materialized_view pmv where pmv.__person_id = 1 and pmv.__id = 1) and dmv.__person_id = 1;
select name, created_at from sc.files_materialized_view fmv where fmv.directory = 0 and fmv.__person_id = 1;

-- REPORTS
select start_at || ' - ' || end_at as period, created_at, created_by from sc.periodic_reports_materialized_view where directory = 0 and __person_id = 1 and type = 'Narrative';     
select start_at || ' - ' || end_at as period, created_at, created_by from sc.periodic_reports_materialized_view where directory = 0 and __person_id = 1 and type = 'Financial';     

-- TEAM MEMBERS - NEED TO GET FULLNAME AND ROLE 
select person from public.project_memberships_materialized_view where project = 0 and __person_id = 0; 

-- PARTNERSHIPS
select count(id) from sc.partnerships_materialized_view where project = 0 and __person_id = 1;

select orgmv.name,pmv.agreement from sc.partnerships_materialized_view pmv inner join 
(select somv.base64,pomv.name, somv.id, pomv.id  from sc.organizations_materialized_view somv
inner join public.organizations_materialized_view pomv using (id) where somv.__person_id = 0 and pomv.__person_id = 0) as orgmv on pmv.partner = orgmv.base64 where pmv.project = 0 and pmv.__person_id = 0;

-- CHANGE REQS
select * from sc.change_to_plans_materialized_view cpmv where cpmv.id in (select change_to_plan from sc.projects_materialized_view pmv where pmv.id = 0 and pmv.__person_id = 0) and cpmv.__person_id = 0;

-- LANGUAGE ENGAGEMENTS - ethnologue code,status, products 
select * from sc.language_engagements_materialized_view where project = 0 and __person_id = 1;



-- POSTS
select type,shareability,pmv.created_at, pmv.created_by, ppmv.public_first_name || ' ' || ppmv.public_last_name as full_name from 
sc.posts_materialized_view pmv inner join  public.people_materialized_view ppmv on pmv.created_by = 
ppmv.id where directory = (select posts_directory from sc.projects_materialized_view where __person_id = 0 and project = 0) and pmv.__person_id = 0;

