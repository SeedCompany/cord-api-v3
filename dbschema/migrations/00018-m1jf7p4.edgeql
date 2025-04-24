CREATE MIGRATION m1jf7p43qsddgdjn2fues62z6hemf2eshuiedx64dod5nkgrrssaaq
    ONTO m1d2nmzhgsu7jc75xtbjt4zdvroszkfcbtmdrap2kohcto4fbpqoia
{
  CREATE FUNCTION default::array_join_maybe(array: array<std::str>, delimiter: std::str) -> OPTIONAL std::str USING (
    WITH joined := std::array_join(array, delimiter)
    SELECT (IF (joined = '') THEN <std::str>{} ELSE joined)
  );
};
