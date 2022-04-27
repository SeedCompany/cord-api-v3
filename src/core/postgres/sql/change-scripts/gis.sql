create extension if not exists postgis;
alter table sc.languages add column if not exists coordinates:common.geography;
delete from sc.languages;
insert into sc.languages(id,name,display_name,owning_person,owning_group, created_by, modified_by, coordinates)
values
(1,'Kannada', 'KND', 1,1,1,1,'SRID=4326;POINT(77.5 12.9)'),
(2,'English', 'ENG',1,1,1,1, 'SRID=4326;POINT(-96.1 32.7)');


select round(common.ST_Distance
(
	(select coordinates from sc.languages where id = 1)::common.geography,
	(select coordinates from sc.languages where id = 2)::common.geography
)/1000) || ' km' as distance;

select common.ST_AsLatLonText(coordinates::text) from sc.languages;
