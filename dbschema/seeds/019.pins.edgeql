with
  usersJson := to_json('[
    {
      "name": "Bilbo",
      "pinnables": [
        "Sindarin",
        "Quenya",
        "Dwarvish/Elvish Alliance",
        "Fellowship of Halfing Languages",
        "Emyn Muil",
        "Arnor Lake",
        "South Downs"
      ]
    },
    {
      "name": "Peregrin",
      "pinnables": [
        "English",
        "Sindarin",
        "Eriador Church",
        "The Rivendell Partnership",
        "Misty Mountains",
        "Lothlorien"
      ]
    },
    {
      "name": "Aragorn",
      "pinnables": [
        "Sindarin",
        "Eriador Church",
        "The Rivendell Partnership",
        "Emyn Muil",
        "Misty Mountains",
        "Lothlorien"
      ]
    }
  ]'),
  users := distinct (
    for user in json_array_unpack(usersJson)
    union (
      update User
      filter .realFirstName = <str>user['name']
      set {
        pins += (
          select Mixin::Pinnable
          filter [is Mixin::Named].name = <str>json_array_unpack(user['pinnables'])
        )
      }
    )
  ),
  modified := (select users filter .modifiedAt = datetime_of_statement())
select {`Modified Users` := modified.realFirstName ++ ' ' ++ modified.realLastName}
filter count(modified) > 0;
