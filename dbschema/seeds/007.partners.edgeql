with
  partnersJson := to_json('[
    {
      "name": "Eriador Church",
      "pmcEntityCode": "AAA",
      "types": ["Managing"],
      "financialReportingTypes": ["Funded"]
    },
    {
      "name": "Ered Luin Translation Syndicate",
      "pmcEntityCode": "AAB",
      "types": ["Funding"],
      "financialReportingTypes": ["FieldEngaged"],
      "countries": ["Burma", "Taiwan"]
    },
    {
      "name": "Rohan Linguistics",
      "pmcEntityCode": "AAA",
      "types": ["Managing", "Funding"],
      "financialReportingTypes": ["FieldEngaged", "Funded"],
      "languageOfWiderCommunication": "Westron",
      "countries": ["Chad"]
    },
    {
      "name": "Rhun For Zero",
      "pmcEntityCode": "AAB",
      "types": ["Impact"],
      "financialReportingTypes": ["Hybrid"],
      "languagesOfConsulting": ["Quenya", "Sindarin"]
    },
    {
      "name": "Gondor Foundation",
      "pmcEntityCode": "AAA",
      "types": ["Managing", "Resource"],
      "financialReportingTypes": ["Hybrid", "Funded"],
      "poc": "Aragorn",
      "languagesOfConsulting": ["English", "Sindarin"]
    },
    {
      "name": "Ered Mithrim Group",
      "pmcEntityCode": "AAB",
      "types": ["Managing", "Technical"],
      "financialReportingTypes": ["Funded", "FieldEngaged"],
      "fieldRegions": ["Africa - Sahel"]
    },
    {
      "name": "The Rivendell Partnership",
      "pmcEntityCode": "AAA",
      "types": ["Managing"],
      "financialReportingTypes": ["Funded"],
      "fieldRegions": ["Africa - Southern", "Asia - Islands"]
    },
    {
      "name": "Dwarvish/Elvish Alliance",
      "pmcEntityCode": "AAB",
      "types": ["Technical"],
      "financialReportingTypes": ["FieldEngaged"],
      "languageOfWiderCommunication": "Khuzdul"
    },
    {
      "name": "The Buckland Organization",
      "pmcEntityCode": "AAA",
      "types": ["Impact"],
      "financialReportingTypes": ["Funded"]
    },
    {
      "name": "Fellowship of Halfing Languages",
      "pmcEntityCode": "AAB",
      "types": ["Managing"],
      "financialReportingTypes": ["Funded", "Hybrid", "FieldEngaged"]
    },
    {
      "name": "Rivers and Mountains Translation Group",
      "pmcEntityCode": "AAA",
      "types": ["Resource"],
      "financialReportingTypes": ["Funded"],
      "poc": "Meriadoc"
    },
    {
      "name": "Hobbiton Ministry",
      "pmcEntityCode": "AAB",
      "types": ["Managing"],
      "financialReportingTypes": ["Funded"]
    },
    {
      "name": "Linguistics Seminary of Sutherland",
      "pmcEntityCode": "AAB",
      "types": ["Managing"],
      "financialReportingTypes": ["Hybrid"]
    },
    {
      "name": "Heart and Minds Across Belegaer",
      "pmcEntityCode": "AAB",
      "types": ["Managing"],
      "financialReportingTypes": ["Funded"]
    },
    {
      "name": "The Gray Havens Initiative",
      "pmcEntityCode": "AAB",
      "types": ["Managing"],
      "financialReportingTypes": ["Funded"]
    }
  ]'),
  partners := (
    for partner in json_array_unpack(partnersJson)
    union (
      with
        organization := (select Organization filter .name = <str>partner['name']),
      select (
        (select Partner filter .name = organization.name) ??
        (insert Partner {
          organization := organization,
          projectContext := organization.projectContext,
          name := organization.name,
          pmcEntityCode := <str>partner['pmcEntityCode'],
          types := <str>json_array_unpack(partner['types']),
          financialReportingTypes := <str>json_array_unpack(partner['financialReportingTypes']),
          pointOfContact := assert_single((select User filter .realFirstName = <str>json_get(partner, 'poc'))),
          languageOfWiderCommunication := assert_single((select Language filter .name = <str>json_get(partner, 'languageOfWiderCommunication'))),
          languagesOfConsulting := (select Language filter .name in <str>json_array_unpack(json_get(partner, 'languagesOfConsulting'))),
          fieldRegions := (select FieldRegion filter .name in <str>json_array_unpack(json_get(partner, 'fieldRegions'))),
          countries := (select Location filter .name in <str>json_array_unpack(json_get(partner, 'countries'))),
        })
      )
    )
  ),
  new := (select partners filter .createdAt = datetime_of_statement())
select { `Added Partners` := new.name }
filter count(new) > 0;
