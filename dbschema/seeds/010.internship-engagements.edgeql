with
  engagementsJson := to_json('[
   {
      "project": "Arwen Evenstar Intern",
      "intern": "Samwise",
      "status": "Completed",
      "mentor": "Gandalf",
      "countryOfOrigin": "New Zealand",
      "startDateOverride": "2019-04-01",
      "endDateOverride": "2020-06-30"
    },
    {
      "project": "Glorfindel - Exegetical Facilitator",
      "intern": "Frodo",
      "status": "DiscussingChangeToPlan",
      "mentor": "Bilbo",
      "countryOfOrigin": "New Zealand",
      "startDateOverride": "2023-01-01",
      "endDateOverride": "2024-07-22"
    },
    {
      "project": "Cohort of the Ents",
      "intern": "Meriadoc",
      "status": "Active"
    },
    {
      "project": "Barliman Butterbur Intern",
      "intern": "Peregrin",
      "status": "Suspended"
    },
    {
      "project": "Eomer of Rohan Intern",
      "intern": "Aragorn",
      "status": "FinalizingCompletion",
      "countryOfOrigin": "New Zealand"
    }
  ]'),
  engagements := (
    for engagement in json_array_unpack(engagementsJson)
    union (
      with
        intern := assert_single((select User filter .realFirstName = <str>engagement['intern'])),
        project := (select InternshipProject filter .name = <str>engagement['project']),
        mentor := assert_single((select User filter .realFirstName = <str>json_get(engagement, 'mentor'))),
        countryOfOrigin := (select Location filter .name = <str>json_get(engagement, 'countryOfOrigin'))
      select (
        (select InternshipEngagement filter .intern = intern and .project = project) ??
        (insert InternshipEngagement {
          project := project,
          intern := intern,
          mentor := mentor,
          projectContext := project.projectContext,
          status := <Engagement::Status>engagement['status'],
          startDateOverride := <cal::local_date>json_get(engagement, 'startDateOverride'),
          endDateOverride := <cal::local_date>json_get(engagement, 'endDateOverride'),
          countryOfOrigin := countryOfOrigin
        })
      )
    )
  ),
  new := (select engagements filter .createdAt = datetime_of_statement())
select { `Added Internship Engagements: Internship -> Project` := new.intern.realFirstName ++ ' ' ++ new.intern.realLastName ++ ' -> ' ++ new.project.name }
filter count(new) > 0;
