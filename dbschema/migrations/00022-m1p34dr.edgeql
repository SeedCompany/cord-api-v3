CREATE MIGRATION m1xp5mbrgbcsdkvhimirvlj2hueu7m7aeyowjcp3wl4itrzityln4q
    ONTO m12v6mjpnma3kdngompvtea3ldgqtcpm45b2wcjxwvt5jxyu53zsuq
{
  CREATE EXTENSION pg_unaccent VERSION '1.1';
  ALTER FUNCTION default::str_sortable(value: std::str) USING (
    std::str_lower(ext::pg_unaccent::unaccent(std::str_trim(std::re_replace(r'[ [\]|,\-$]+', ' ', value, flags := 'g'))))
  );
};
