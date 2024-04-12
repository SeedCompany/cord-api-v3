with
  ceremoniesJson := to_json($$[
    {
      "engagement": ["Misty Mountains", "English"],
      "estimatedDate": "2022-04-02",
      "actualDate": "2023-06-13"
    },
    {
      "engagement": ["Arnor Lake", "Quenya"],
      "estimatedDate": "2022-04-02"
    },
    {
      "engagement": ["Emyn Muil", "Khuzdul"],
      "estimatedDate": "2022-04-02"
    }
  ]$$),
  ceremonies := (
    for ceremony in json_array_unpack(ceremoniesJson)
    union (
      with
        engagement := assert_exists((
          select LanguageEngagement
            filter .project.name = <str>(ceremony['engagement'])[0]
            and .language.name = <str>(ceremony['engagement'])[1]
          ))
      update engagement.ceremony set {
        estimatedDate := <cal::local_date>json_get(ceremony, 'estimatedDate'),
        planned := true,
        actualDate := <cal::local_date>json_get(ceremony, 'actualDate')
      }
    )
  ),
  modified := (select ceremonies filter .modifiedAt = datetime_of_statement())
select { `Modified Ceremony: ` := modified.id }
filter count(modified) > 0;
