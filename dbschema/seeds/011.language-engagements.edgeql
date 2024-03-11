with
  engagementsJson := to_json('[
   {
      "project": "Misty Mountains",
      "language": "English",
      "status": "InDevelopment",
      "startDateOverride": "2020-04-01",
      "endDateOverride": "2020-06-30"
    },
    {
      "project": "Arnor Lake",
      "language": "Quenya",
      "status": "FinalizingCompletion",
      "startDateOverride": "2016-04-01",
      "endDateOverride": "2017-06-30"
    },
    {
      "project": "Lothlorien",
      "language": "Sindarin",
      "status": "Active"
    },
    {
      "project": "Emyn Muil",
      "language": "Khuzdul",
      "status": "Active"
    },
    {
      "project": "South Downs",
      "language": "Westron",
      "status": "FinalizingCompletion",
      "paratextRegistryId": "1234567890"
    }
  ]'),
  engagements := (
    for engagement in json_array_unpack(engagementsJson)
    union (
      with
        language := assert_single((select Language filter .name = <str>engagement['language'])),
        project := (select TranslationProject filter .name = <str>engagement['project']),
      select (
        (select LanguageEngagement filter .language = language and .project = project) ??
        (insert LanguageEngagement {
          project := project,
          projectContext := project.projectContext,
          status := <Engagement::Status>engagement['status'],
          startDateOverride := <cal::local_date>json_get(engagement, 'startDateOverride'),
          endDateOverride := <cal::local_date>json_get(engagement, 'endDateOverride'),
          language := language,
          paratextRegistryId := <str>json_get(engagement, 'paratextRegistryId')
        })
      )
    )
  ),
  new := (select engagements filter .createdAt = datetime_of_statement())
select { `Added Language Engagements: Language -> Project` := new.language.name ++ ' -> ' ++ new.project.name }
filter count(new) > 0;
