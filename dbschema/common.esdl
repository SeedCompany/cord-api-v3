module default {
  global currentUserId: uuid;
  
  scalar type ReportPeriod extending enum<Monthly, Quarterly>;
  
  # Helper function to workaround native support for sort ignoring accents
  # https://stackoverflow.com/a/11007216
  # https://github.com/edgedb/edgedb/issues/386
  function str_sortable(value: str) -> str
  using (
    str_lower(
      re_replace('Ñ', 'N',
        str_trim(re_replace('[ [\\]|,\\-$]+', ' ', value, flags := 'g')),
        flags := 'g'
       )
    )
  );
}
