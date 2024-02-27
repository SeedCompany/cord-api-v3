CREATE MIGRATION m1p2k7nnmg7o3qxxzywndo2r4zjwq2bfzi6lqakzhmzvyakc46o6uq
    ONTO m157gy3t5mh6e3rdvucz3kyjnyvqcztjujwg6tidwsgiopximyrcja
{
  ALTER FUNCTION default::date_range_get_upper(period: range<cal::local_date>) USING ((<cal::local_date><std::str>std::assert_exists(std::range_get_upper(period)) - <cal::date_duration>'1 day'));
};
