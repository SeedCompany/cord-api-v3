with
  root := (select RootUser),
  zones := (
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
  ),
  new := (select zones filter .createdAt = datetime_of_statement())
select { `Added Field Zones` := new.name }
filter count(new) > 0;
with
  root := (select RootUser),
  regions := (
    for item in {
      (zone := "Americas, Pacific, Eurasia", regions := {"Americas", "Pacific", "Eurasia"}),
      (zone := "Africa", regions := {
        "Africa - Southern",
        "Africa - Anglophone East",
        "Africa - Sahel",
        "Africa - Congo Basin",
        "Africa - Anglophone West"}),
      (zone := "Asia", regions := {"Asia - Islands", "Asia - South", "Asia - Mainland"})
    }
    union (
      with zone := (select FieldZone filter .name = item.zone)
      select (
        for region in item.regions
        union (
          (select FieldRegion filter .name = region) ??
          (insert FieldRegion {
            name := region,
            fieldZone := zone,
            director := root
          })
        )
      )
    )
  ),
  new := (select regions filter .createdAt = datetime_of_statement())
select { `Added Field Regions` := new.name }
filter count(new) > 0;
