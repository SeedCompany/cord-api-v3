with
  root := (select RootUser),
  zones := array_agg((
    for name in {
      "Americas, Pacific, Eurasia",
      "Africa",
      "Asia"
    }
    union (
      (select FieldZone filter .name = name) ??
      (insert FieldZone {
        name := name,
        director := root
      })
    )
  )),
  regions := (
    for region in {
      ("Americas", zones[0]),
      ("Pacific", zones[0]),
      ("Eurasia", zones[0]),
      ("Africa - Southern", zones[1]),
      ("Africa - Anglophone East", zones[1]),
      ("Africa - Sahel", zones[1]),
      ("Africa - Congo Basin", zones[1]),
      ("Africa - Anglophone West", zones[1]),
      ("Asia - Islands", zones[2]),
      ("Asia - South", zones[2]),
      ("Asia - Mainland", zones[2]),
    }
    union (
      (select FieldRegion filter .name = region.0) ??
      (insert FieldRegion {
        name := region.0,
        fieldZone := region.1,
        director := root
      })
    )
  )
select regions;
