with
  ceremoniesJson := to_json($$[
    {
      "project": "Misty Mountains",
      "estimatedDate": "2022-04-01",
      "actualDate": "2023-06-12"
    }
  ]$$),
  ceremonies := (
    for ceremony in json_array_unpack(ceremoniesJson)
    union (
      with
        project := (select Project filter .name = <str>ceremony['project']),
      update Engagement::Ceremony filter .project = project set {
        estimatedDate := <cal::local_date>json_get(ceremony, 'estimatedDate'),
        actualDate := <cal::local_date>json_get(ceremony, 'actualDate')
      }
    )
  ),
  modified := (select ceremonies filter .modifiedAt = datetime_of_statement())
select { `Modified Ceremony: ` := modified.id }
filter count(modified) > 0;
