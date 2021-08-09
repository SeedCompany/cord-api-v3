create or replace function public.mv_fn(pSecurityTableName text, pToggleMV int)
returns integer
language plpgsql
as $$
declare    
    materialized_view_name text;  
begin
    materialized_view_name := replace(pSecurityTableName, '_data', '_materialized_view');
    if pToggleMV = 0 then 
        return 0;
    elsif pToggleMV = 1 then 
        execute format('refresh materialized view %I.%I', split_part(materialized_view_name, '.',1),split_part(materialized_view_name, '.',2)); 
    else 
        execute format('refresh materialized view %I.%I concurrently', split_part(materialized_view_name, '.',1),split_part(materialized_view_name, '.',2)); 
    end if;
    return 0;
end; $$;