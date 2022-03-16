-- sc.languages
--insert into sc.languages(name, display_name,island, coordinates, owning_person,owning_group, created_by, modified_by)
--values
--('English', 'English', 'USA', 'SRID=4326;POINT(-96.1 32.7)',  1,1,1,1),
--('Spanish', 'Spanish', 'MEX', null, 1,1,1,1),
--('Hindi', 'Hindi', 'IND', null,1,1,1,1),
--('Kannada', 'Kannada', 'BLR','SRID=4326;POINT(77.5 12.9)', 1,1,1,1);


CREATE OR REPLACE PROCEDURE load_dummy_data()
LANGUAGE PLPGSQL
AS $$
DECLARE
  vEnglishEthId int;
  vSpanishEthId int;
  vHindiEthId int;
  vKannadaEthId int;
BEGIN
  -- todo

END; $$;

call load_dummy_data();