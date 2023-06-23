with
  user := assert_exists(
    (select User filter .email = <str>$email limit 1),
    message := 'User not found'
  ),
  sess := assert_exists((
    update Auth::Session filter .token = <str>$token
    set { user := user }
  ), message := "Token not found")
# select (user{*}, sess{*})
select user
