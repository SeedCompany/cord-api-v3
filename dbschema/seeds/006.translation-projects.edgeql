with
  projectsJson := to_json('[
    {
      "name": "Misty Mountains",
      "step": "EarlyConversations",
      "mouStart": "2020-01-01",
      "mouEnd": "2023-12-30",
      "estimatedSubmission": "2023-12-01",
      "financialReportPeriod": "Monthly"
    },
    {
      "name": "Arnor Lake",
      "step": "FinalizingProposal",
      "mouStart": "2015-01-01",
      "mouEnd": "2018-12-30",
      "estimatedSubmission": "2022-12-01",
      "financialReportPeriod": "Monthly"
    },
    {
      "name": "Lothlorien",
      "step": "Active",
      "mouStart": "2020-01-01",
      "mouEnd": "2025-05-30",
      "financialReportPeriod": "Quarterly"
    },
    {
      "name": "Emyn Muil",
      "step": "Active",
      "mouStart": "2019-03-01",
      "mouEnd": "2022-10-30",
      "financialReportPeriod": "Quarterly"
    },
    {
      "name": "South Downs",
      "step": "FinalizingCompletion",
      "mouStart": "2020-01-01",
      "mouEnd": "2023-12-30",
      "estimatedSubmission": "2023-09-01",
      "financialReportPeriod": "Monthly"
    }
  ]'),
  projects := (
    for project in json_array_unpack(projectsJson)
    union (
      select (
        (select TranslationProject filter .name = <str>project['name']) ??
        (insert TranslationProject {
          name := <str>project['name'],
          step := <str>project['step'],
          mouStart := <cal::local_date>project['mouStart'],
          mouEnd := <cal::local_date>project['mouEnd'],
          estimatedSubmission := <cal::local_date>json_get(project, 'estimatedSubmission'),
          financialReportPeriod := <str>project['financialReportPeriod']
        })
      )
    )
  ),
  new := (select projects filter .createdAt = datetime_of_statement())
select { `Added Projects` := new.name }
filter count(new) > 0;

# Update all projects to self reference for their context (has to be separate query)
# https://github.com/edgedb/edgedb/issues/3960
with updated := (
  for project in Project union (
    update project.projectContext
    set { projects := project }
  )
)
select <str>{};
