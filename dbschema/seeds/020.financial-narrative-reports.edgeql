with
  periodicReportsJson := to_json('[
    {
      "type": "Narrative",
      "project": "Misty Mountains",
      "start": "2022-01-01",
      "end": "2022-03-31",
      "receivedDate": "2022-04-01",
      "skippedReason": "No funding"
    },
    {
      "type": "Narrative",
      "project": "Arnor Lake",
      "start": "2023-01-01",
      "end": "2023-03-31",
      "skippedReason": "Change in translation team"
    },
    {
      "type": "Narrative",
      "project": "Lothlorien",
      "start": "2023-04-01",
      "end": "2023-06-30",
      "receivedDate": "2023-07-11"
    },
    {
      "type": "Financial",
      "project": "Emyn Muil",
      "start": "2024-07-01",
      "end": "2024-09-30",
      "receivedDate": "2024-12-03"
    },
    {
      "type": "Narrative",
      "project": "South Downs",
      "start": "2024-10-01",
      "end": "2024-12-31"
    },
    {
      "type": "Financial",
      "project": "Glorfindel - Exegetical Facilitator",
      "start": "2025-01-01",
      "end": "2025-03-31",
      "receivedDate": "2025-04-01"
    },
    {
      "type": "Financial",
      "project": "Arwen Evenstar Intern",
      "start": "2025-04-01",
      "end": "2025-06-30",
      "receivedDate": "2025-07-01",
      "skippedReason": "Change in location"
    },
    {
      "type": "Financial",
      "project": "Eomer of Rohan Intern",
      "start": "2025-07-01",
      "end": "2025-09-30"
    },
    {
      "type": "Financial",
      "project": "Cohort of the Ents",
      "start": "2025-10-01",
      "end": "2025-12-31",
      "receivedDate": "2026-01-01"
    },
    {
      "type": "Financial",
      "project": "Barliman Butterbur Intern",
      "start": "2026-01-01",
      "end": "2026-03-31",
      "receivedDate": "2026-04-01"
    }
  ]'),
  newPeriodicReports := (
    for periodicReport in json_array_unpack(periodicReportsJson)
    union (
      with
        project := assert_single((select Project filter .name = <str>periodicReport['project'])),
        period := range(<cal::local_date>periodicReport['start'], <cal::local_date>periodicReport['end']),
      select (
        if periodicReport['type'] = <json>'Financial' then (
          (select FinancialReport filter .project = project and .period = period) ??
          (insert FinancialReport {
            project := project,
            projectContext := project.projectContext,
            container := project,
            period := period,
            receivedDate := <cal::local_date>json_get(periodicReport, 'receivedDate'),
            skippedReason := <str>json_get(periodicReport, 'skippedReason')
          })
        ) else (
          (select NarrativeReport filter .project = project and .period = period) ??
          (insert NarrativeReport {
            project := project,
            projectContext := project.projectContext,
            container := project,
            period := period,
            receivedDate := <cal::local_date>json_get(periodicReport, 'receivedDate'),
            skippedReason := <str>json_get(periodicReport, 'skippedReason')
          })

        )
      )
    )
  ),
  new := (select newPeriodicReports filter .createdAt = datetime_of_statement())
select { `Added Periodic Reports: Project -> Period`
  := new.container.name ++ ' -> ' ++ to_str(range_unpack(new.period)) }
filter count(new) > 0;
