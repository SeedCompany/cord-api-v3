-- create or replace function public.update(pPersonId int, pId int, pTableName text, 
-- -- get record
-- pRecord hstore,
-- -- pToggleSensitivity int
-- )
-- returns int 
-- language plpgsql
-- as $$ 
-- declare
-- rec1 record;
-- rec2 record; 
-- column_access_level public.access_level;
-- column_data_type text;
-- column_udt_name text;
-- security_table_name text;
-- table_is_cleared boolean;
-- table_column_name text;
-- sqlString text;
-- begin

-- -- get __is_cleared and loop through every column in security table and make sure it has write permission 
--     security_table_name := replace(pTableName, '_data', '_security');
--     for rec1 in (select column_name into table_column_name from information_schema.columns where table_schema = split_part(pTableName, '.',1) and table_name = split_part(pTableName, '.', 2)) loop    
--         execute format('select _%I, __is_cleared from %I where __id = '|| pId ' and __person_id = '|| pPersonId , rec1.column_name, security_table_name) into column_access_level, table_is_cleared;
--         raise info 'create.fn column_access_level: %', column_access_level;
--         if __is_cleared = false or column_access_level is null or column_access_level != 'Write' then 
--             raise notice 'don''t have write access to column: % ', rec1.column_name;
--             return 2;
--         end if;
--     end loop;

-- -- insert row! 
--     for rec2 in (select skeys(pRecord), svals(pRecord)) loop 
    
--         select data_type, udt_name into column_data_type, column_udt_name from information_schema.columns where table_schema = split_part(pTableName, '.',1) and table_name = split_part(pTableName, '.', 2) and column_name = rec2.skeys; 

--         if column_data_type = 'ARRAY'then 
--             execute format('update '|| pTableName || ' set '|| rec2.skeys || ' = ' || 'ARRAY' || rec2.svals ||'::' ||  'public.' || substr(column_udt_name, 2, length(column_udt_name)-1) || '[],' || ' where id = '|| pId);
--         else 
--             execute format('update '|| pTableName || ' set '|| rec2.skeys || ' = ' || quote_literal(rec2.svals) || ' where id = '|| pId);
--         end if;

--     end loop;
--     return 0;
-- end; $$;