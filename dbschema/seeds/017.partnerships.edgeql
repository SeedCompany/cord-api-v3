with
partnershipsJson := to_json($$[
  {
    "project": "South Downs",
    "partner": "Rohan Linguistics",
    "types": ["Funding"]
  },
  {
    "project": "Emyn Muil",
    "partner": "Rohan Linguistics",
    "types": ["Funding", "Managing"],
    "financialReportingType": "FieldEngaged"
  },
  {
    "project": "Emyn Muil",
    "partner": "Ered Luin Translation Syndicate",
    "types": ["Funding"],
    "primary": false
  },
  {
    "project": "Emyn Muil",
    "partner": "Rhun For Zero",
    "types": ["Impact"],
    "primary": false
  },
  {
    "project": "Arwen Evenstar Intern",
    "partner": "Eriador Church",
    "types": ["Managing"],
    "financialReportingType": "Funded"
  },
  {
    "project": "Cohort of the Ents",
    "partner": "Gondor Foundation",
    "types": ["Managing", "Resource"],
    "financialReportingType": "Hybrid"
  }
]$$),

partnerships := (
  for entry in json_array_unpack(partnershipsJson)
  union (
    with
      project := (select Project filter .name = <str>entry['project']),
      partner := (select Partner filter .name = <str>entry['partner'])
    select (
      (select Partnership filter .partner = partner and .project = project) ??
      (insert Partnership {
        project := project,
        partner := partner,
        projectContext := project.projectContext,
        types := <str>json_array_unpack(json_get(entry, 'types')),
        financialReportingType := <str>json_get(entry, 'financialReportingType'),
        primary := <bool>json_get(entry, 'primary') ?? true,
      })
    )
  )
),

new := (select partnerships filter .createdAt = datetime_of_statement())
select { `Added Partnerships` := new.partner.name ++ ' ' ++ new.project.name }
filter count(new) > 0;
