with
  organizationsJson := to_json('[
    {
      "name": "Eriador Church",
      "acronym": "EC",
      "types": ["Church", "Mission"],
      "reach": ["Local", "National"]
    },
    {
      "name": "Ered Luin Translation Syndicate",
      "acronym": "ELTW",
      "types": ["Parachurch", "Mission"],
      "reach": ["National", "Regional"]
    },
    {
      "name": "Rohan Linguistics",
      "acronym": "RL",
      "types": ["Church"],
      "reach": ["Local", "Regional"]
    },
    {
      "name": "Rhun For Zero",
      "acronym": "RFZ",
      "types": ["TranslationOrganization", "Mission"],
      "reach": ["Global"]
    },
    {
      "name": "Gondor Foundation",
      "acronym": "GF",
      "types": ["Church", "TranslationOrganization"],
      "reach": ["Local"]
    },
    {
      "name": "Ered Mithrim Group",
      "acronym": "EMG",
      "types": ["Church", "Parachurch"],
      "reach": ["Local", "Global"]
    },
    {
      "name": "The Rivendell Partnership",
      "acronym": "TRP",
      "types": ["Church"],
      "reach": ["Global", "Regional"]
    },
    {
      "name": "Dwarvish/Elvish Alliance",
      "acronym": "DEA",
      "types": ["Parachurch", "Mission"],
      "reach": ["Global"]
    },
    {
      "name": "The Buckland Organization",
      "acronym": "BO",
      "types": ["Alliance", "Mission", "Parachurch"],
      "reach": ["Local", "Global", "Regional"]
    },
    {
      "name": "Fellowship of Halfing Languages",
      "acronym": "FAHL",
      "types": ["Alliance"],
      "reach": ["Local", "National"]
    },
    {
      "name": "Rivers and Mountains Translation Group",
      "acronym": "RMTG",
      "types": ["Church", "Mission"],
      "reach": ["Local", "Regional"]
    },
    {
      "name": "Hobbiton Ministry",
      "acronym": "HM",
      "types": ["Church", "Mission"],
      "reach": ["National", "Regional"]
    },
    {
      "name": "Linguistics Seminary of Sutherland",
      "acronym": "LSS",
      "types": ["Church"],
      "reach": ["National", "Regional", "Global"]
    },
    {
      "name": "Heart and Minds Across Belegaer",
      "acronym": "HMAB",
      "types": ["Church", "Mission"],
      "reach": ["National", "Regional"]
    },
    {
      "name": "The Gray Havens Initiative",
      "acronym": "GHI",
      "types": ["Mission"],
      "reach": ["National", "Regional", "Global"]
    }
  ]'),
  organizations := (
    for organization in json_array_unpack(organizationsJson)
    union (
      (select Organization filter .name = <str>organization['name']) ??
      (insert Organization {
        projectContext := (insert Project::Context),
        name := <str>organization['name'],
        acronym := <str>organization['acronym'],
        types := <str>json_array_unpack(organization['types']),
        reach := <str>json_array_unpack(organization['reach'])
      })
    )
  ),
  new := (select organizations filter .createdAt = datetime_of_statement())
select { `Added Organizations` := new.name }
filter count(new) > 0;
