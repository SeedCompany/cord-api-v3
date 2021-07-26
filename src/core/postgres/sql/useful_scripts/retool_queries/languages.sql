-- MODIFICATIONS


-- RETOOL QUERIES
-- PARENT TABLE 
select lmv.display_name, lmv.sensitivity,sd.iso_639  from sc.languages_materialized_view lmv inner join sil.table_of_languages sd using (id) where lmv.__person_id = 0; 

select count(distinct id) from sc.languages_materialized_view;

