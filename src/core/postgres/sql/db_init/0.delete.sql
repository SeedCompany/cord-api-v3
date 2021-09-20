drop schema if exists public cascade;
drop schema if exists sc cascade;
drop schema if exists sil cascade;

-- DELETE EVERYTHING

-- TABLES -------------------------------------------------------------------------------

-- DO $$ DECLARE
--     r RECORD;
-- BEGIN
--     -- if the schema you operate on is not "current", you will want to
--     -- replace current_schema() in query with 'schematodeletetablesfrom'
--     -- *and* update the generate 'DROP...' accordingly.
--     FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema()) LOOP
--         EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
--     END LOOP;
-- END $$;

-- -- ENUMs -------------------------------------------------------------------------------

-- drop type if exists public.table_name cascade;
-- drop type if exists public.column_name cascade;
-- drop type if exists public.location_type cascade;
-- drop type if exists public.person_to_org_relationship_type cascade;
-- drop type if exists public.group_type cascade;
-- drop type if exists public.mime_type cascade;
-- drop type if exists public.book_name cascade;
-- drop type if exists public.access_level cascade;
-- drop type if exists public.sensitivity cascade;

-- drop type if exists sc.involvements cascade;
-- drop type if exists sc.people_transitions cascade;
-- drop type if exists sc.org_transitions cascade;
-- drop type if exists sc.sensitivity cascade;
-- drop type if exists sc.financial_reporting_types cascade;
-- drop type if exists sc.partner_types cascade;
-- drop type if exists sc.project_step cascade;
-- drop type if exists sc.project_status cascade;
-- drop type if exists sc.budget_status cascade;
-- drop type if exists sc.engagement_status cascade;
-- drop type if exists sc.project_engagement_tag cascade;
-- drop type if exists sc.internship_methodology cascade;
-- drop type if exists sc.internship_position cascade;
-- drop type if exists sc.product_mediums cascade;
-- drop type if exists sc.product_methodologies cascade;
-- drop type if exists sc.product_purposes cascade;
-- drop type if exists sc.product_type cascade;
-- drop type if exists sc.change_to_plan_type cascade;
-- drop type if exists sc.change_to_plan_status cascade;

-- -- FUNCTIONS ---------------------------------------------------------------------------

-- -- Triggers


-- -- Migration
-- drop function if exists migrate_org cascade;
-- drop function if exists migrate_user cascade;
-- drop function if exists create_sc_role cascade;
-- drop function if exists add_user_role cascade;

-- -- Authentication
-- drop function if exists sc_add_user cascade;
-- drop function if exists sys_login cascade;
-- drop function if exists sys_register cascade;

-- -- Organization
-- drop function if exists sc_add_org cascade;

-- -- Authorization
-- drop function if exists sys_add_member cascade;
-- drop function if exists sys_add_column_access_for_user cascade;
-- drop function if exists sys_add_column_access_for_group cascade;
-- drop function if exists sys_add_row_access_for_user cascade;
-- drop function if exists sys_add_row_access_for_group cascade;
