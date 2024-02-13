with
  projectsJson := to_json('[
    {
      "name": "Glorfindel - Exegetical Facilitator",
      "step": "DiscussingChangeToPlan",
      "mouStart": "2021-07-01",
      "mouEnd": "2024-12-30",
      "estimatedSubmission": "2024-10-01",
      "financialReportPeriod": "Monthly"
    },
    {
      "name": "Arwen Evenstar Intern",
      "step": "PendingConceptApproval",
      "mouStart": "2022-10-01",
      "mouEnd": "2025-12-30",
      "financialReportPeriod": "Quarterly"
    },
    {
      "name": "Eomer of Rohan Intern",
      "step": "Active",
      "mouStart": "2022-02-01",
      "mouEnd": "2026-06-30",
      "financialReportPeriod": "Monthly"
    },
    {
      "name": "Cohort of the Ents",
      "step": "PendingFinancialEndorsement",
      "mouStart": "2022-02-01",
      "mouEnd": "2026-06-30",
      "financialReportPeriod": "Quarterly"
    },
    {
      "name": "Barliman Butterbur Intern",
      "step": "OnHoldFinanceConfirmation",
      "mouStart": "2018-02-01",
      "mouEnd": "2022-07-30",
      "financialReportPeriod": "Monthly"
    }
  ]'),
  projects := (
    for project in json_array_unpack(projectsJson)
    union (
      select (
        (select InternshipProject filter .name = <str>project['name']) ??
        (insert InternshipProject {
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
select { `Added Intership Projects` := new.name }
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
