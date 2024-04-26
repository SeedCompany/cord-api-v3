module default {
  global currentActorId: uuid;
  global currentActor := (select Actor filter .id = global currentActorId);
  global currentUser := (select User filter .id = global currentActorId);
  global currentRoles := (global currentActor).roles;

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
  
  scalar type nanoid extending str;
  
  scalar type RichText extending json;
  
  # A fake function to produce valid EdgeQL syntax.
  # This will be reflected to dynamically inject portable shapes in our EdgeQL queries.
  function hydrate(typeName: str, scopedValue: json) -> str
    using (typeName);
  
  # Get the inclusive upper bound of the given date range.
  function date_range_get_upper(period: range<cal::local_date>) -> cal::local_date
    using (<cal::local_date><str>assert_exists(range_get_upper(period)) - <cal::date_duration>"1 day");
}
