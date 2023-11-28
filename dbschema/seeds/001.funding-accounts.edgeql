for fa in {
  ("Not Specified", 0),
  ("Asia - Mainland", 1),
  ("Africa", 2),
  ("Asia - Islands", 3),
  ("Asia - South", 4),
  ("Americas, Eurasia", 5),
  ("Pacific", 7)
}
union (
  (select FundingAccount filter .name = fa.0) ??
  (insert FundingAccount {
    name := fa.0,
    accountNumber := fa.1
  })
);
