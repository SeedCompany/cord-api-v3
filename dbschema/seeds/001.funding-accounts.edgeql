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
    (select FundingAccount filter .name = fa.0) ?? (
    with
      account := fa.1,
      idBlock := range(account * 10000 + 11, (account + 1) * 10000)
    insert FundingAccount {
      name := fa.0,
      accountNumber := account,
      # There's a bug that the first FundingAccount insert will fail to apply this default
      departmentIdBlock := (
        insert Finance::Department::IdBlock {
          range := multirange([idBlock]),
          programs := {Project::Type.MomentumTranslation, Project::Type.Internship},
        }
      ),
    })
  )
),
new := (select fundingAccounts filter .createdAt = datetime_of_statement())
select { `Added Funding Accounts` := (new.accountNumber, new.name) }
filter count(new) > 0;
