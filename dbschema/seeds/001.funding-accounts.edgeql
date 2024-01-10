with fundingAccounts := (
  for fa in {
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
  )
),
new := (select fundingAccounts filter .createdAt = datetime_of_statement())
select { `Added Funding Accounts` := (new.accountNumber, new.name) }
filter count(new) > 0;
