module Mixin {
  abstract type Named {
    required name: str {
      rewrite insert, update using (default::str_clean(.name));
    };
    
    index on (default::str_sortable(.name));
    
    index fts::index on (
      fts::with_options(
        .name,
        language := fts::Language.eng,
      )
    );
  } 
}
 
module default {
  function str_clean(string: str) -> optional str
    using(
      with trimmed := str_trim(string, " \t\r\n")
      select if len(trimmed) > 0 then trimmed else <str>{}
    );
}
