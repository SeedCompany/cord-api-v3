with
  passwordHash := <str>$passwordHash,
  user := (select User filter .id = <uuid>$userId)
insert Auth::Identity {
  user := user,
  passwordHash := passwordHash
}
unless conflict on .user
else (
  update Auth::Identity filter User = user
  set { passwordHash := passwordHash }
)
