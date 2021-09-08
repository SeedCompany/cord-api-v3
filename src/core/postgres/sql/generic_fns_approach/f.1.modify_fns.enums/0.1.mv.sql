create or replace procedure public.mv_fn(pSecurityTableName text, pToggleMV public.toggle_mv)
language plpgsql
as $$
declare    
    materialized_view_name text;  
begin
    materialized_view_name := replace(pSecurityTableName, '_data', '_materialized_view');
    if pToggleMV = 'NoRefreshMV' then 
        return;
    elsif pToggleMV = 'RefreshMV' then 
        execute format('refresh materialized view %I.%I', split_part(materialized_view_name, '.',1),split_part(materialized_view_name, '.',2)); 
    else 
        execute format('refresh materialized view concurrently %I.%I', split_part(materialized_view_name, '.',1),split_part(materialized_view_name, '.',2)); 
    end if;
    return;
end; $$;