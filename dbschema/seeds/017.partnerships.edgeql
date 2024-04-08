with
partnershipsJson := to_json($$[
  {
      "project": "South Downs",
      "partner": "Rohan Linguistics",
      "types": ["Funding"],
      "agreementStatus": "NotAttached",
      "primary": true
  },
  {
      "project": "Emyn Muil",
      "partner": "Ered Luin Translation Syndicate",
      "types": ["Funding"],
      "agreementStatus": "NotAttached",
      "primary": true
  },
  {
        "project": "Emyn Muil",
        "partner": "Rohan Linguistics",
        "types": ["Funding", "Managing"],
        "financialReportingType": "FieldEngaged",
        "agreementStatus": "NotAttached",
        "primary": true
  },
  {
      "project": "Emyn Muil",
      "partner": "Rhun For Zero",
      "types": ["Impact"],
      "agreementStatus": "NotAttached",
      "primary": false
  },
  {
      "project": "Arwen Evenstar Intern",
      "partner": "Eriador Church",
      "types": ["Managing"],
      "financialReportingType": "Funded",
      "agreementStatus": "NotAttached",
      "primary": true
  },
  {
      "project": "Cohort of the Ents",
      "partner": "Gondor Foundation",
      "types": ["Managing", "Resource"],
      "financialReportingType": "Hybrid",
      "agreementStatus": "NotAttached",
      "primary": true
  }
]$$),

partnerships := (
  for entry in json_array_unpack(partnershipsJson)
  union (
    with
      project := assert_single((select Project filter .name = <str>entry['project'])),
      partner := assert_single((select Partner filter .name = <str>entry['partner']))
    select (
      (select Partnership filter .partner = partner and .project = project) ??
      (insert Partnership {
        project := project,
        partner := partner,
        projectContext := project.projectContext,
        financialReportingType := <str>json_get(entry, 'financialReportingType'),
        agreementStatus := <str>json_get(entry, 'agreementStatus'),
        primary := <bool>json_get(entry, 'primary') ?? true,
        types := <str>json_array_unpack(json_get(entry, 'types')),
      })
    )
  )
),

new := (select partnerships filter .createdAt = datetime_of_statement())
select { `Added Partrnerships` := new.partner.name ++ ' ' ++ new.project.name }
filter count(new) > 0;
