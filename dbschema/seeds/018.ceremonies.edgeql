with
  ceremoniesJson := to_json($$[
    {
      "engagement": ["Misty Mountains", "English"],
      "estimatedDate": "2022-04-02",
      "actualDate": "2023-06-13"
    }
  ]$$),
  ceremonies := (
    for ceremony in json_array_unpack(ceremoniesJson)
    union (
      with
        languageEngagement := assert_exists((
          select LanguageEngagement
            filter .project.name = <str>(ceremony['engagement'])[0]
            and .language.name = <str>(ceremony['engagement'])[1]
          )),
        engagement := (select Engagement filter .id = languageEngagement.id)
      update Engagement::Ceremony filter .engagement = engagement set {
        estimatedDate := <cal::local_date>json_get(ceremony, 'estimatedDate'),
        actualDate := <cal::local_date>json_get(ceremony, 'actualDate')
      }
    )
  ),
  modified := (select ceremonies filter .modifiedAt = datetime_of_statement())
select { `Modified Ceremony: ` := modified.id }
filter count(modified) > 0;
