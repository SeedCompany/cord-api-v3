select organization from sc.partners_materialized_view where __person_id = 0;
select count(distinct id) from sc.partners_materialized_view;
select types,pmc_entity_code,active, point_of_contact from sc.partners_materialized_view pmv where pmv.__person_id = 1 and pmv.organization = 'defaultOrg';