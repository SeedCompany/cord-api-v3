with
partnershipsJson := to_json($$[
  {
      "partner": "Rohan Linguistics",
      "project": "South Downs",
      "mouStatus": "NotAttached",
      "financialReportingType": "Funded",
      "agreementStatus": "NotAttached",
      "primary": true,
      "types": ["Funding"]
  },
  {
      "partner": "Rhun For Zero",
      "project": "Emyn Muil",
      "mouStatus": "NotAttached",
      "financialReportingType": "Hybrid",
      "agreementStatus": "NotAttached",
      "primary": false,
      "types": ["Impact"]
  },
  {
      "partner": "Eriador Church",
      "project": "Arwen Evenstar Intern",
      "mouStatus": "NotAttached",
      "financialReportingType": "Funded",
      "agreementStatus": "NotAttached",
      "primary": true,
      "types": ["Managing"]
  },
  {
      "partner": "Gondor Foundation",
      "project": "Cohort of the Ents",
      "mouStatus": "NotAttached",
      "financialReportingType": "Hybrid",
      "agreementStatus": "NotAttached",
      "primary": true,
      "types": ["Managing", "Resource"]
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
        mouStatus := <str>json_get(entry, 'mouStatus'),
        financialReportingType := <str>json_get(entry, 'financialReportingType'),
        agreementStatus := <str>json_get(entry, 'agreementStatus'),
        primary := <bool>json_get(entry, 'primary'),
        types := <str>json_array_unpack(json_get(entry, 'types')),
      })
    )
  )
),

new := (select partnerships filter .createdAt = datetime_of_statement())
select { `Added Partrnerships` := new.partner.name ++ ' ' ++ new.project.name }
filter count(new) > 0;
