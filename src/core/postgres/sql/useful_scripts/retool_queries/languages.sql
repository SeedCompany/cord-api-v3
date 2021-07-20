select lmv.display_name, lmv.sensitivity,sd.iso_639  from sc.languages_materialized_view lmv inner join sil.table_of_languages_data sd using (id); 

select count(distinct id) from sc.languages_materialized_view;