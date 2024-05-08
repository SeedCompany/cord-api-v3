with
  organizationsJson := to_json('[
    {
      "name": "Eriador Church",
      "address": "123 Sesame Street, Dallas, TX 12345",
      "acronym": "EC",
      "types": ["Church", "Mission"],
      "reach": ["Local", "National"]
    },
    {
      "name": "Ered Luin Translation Syndicate",
      "address": "456 Wall Street, New York, NY 12345",
      "acronym": "ELTW",
      "types": ["Parachurch", "Mission"],
      "reach": ["National", "Regional"]
    },
    {
      "name": "Rohan Linguistics",
      "address": "1650 Main St., Atlanta, GA",
      "acronym": "RL",
      "types": ["Church"],
      "reach": ["Local", "Regional"]
    },
    {
      "name": "Rhun For Zero",
      "address": "975 1st Street, Jacksonville, FL 98765",
      "acronym": "RFZ",
      "types": ["TranslationOrganization", "Mission"],
      "reach": ["Global"]
    },
    {
      "name": "Gondor Foundation",
      "address": "4567 2nd Street, Jeffersonville, IN 47130",
      "acronym": "GF",
      "types": ["Church", "TranslationOrganization"],
      "reach": ["Local"]
    },
    {
      "name": "Ered Mithrim Group",
      "address": "5577 Market St., Georgetown, KY 40200",
      "acronym": "EMG",
      "types": ["Church", "Parachurch"],
      "reach": ["Local", "Global"]
    },
    {
      "name": "The Rivendell Partnership",
      "address": "1234 Highway 64 NW, Georgetown, IN 47122",
      "acronym": "TRP",
      "types": ["Church"],
      "reach": ["Global", "Regional"]
    },
    {
      "name": "Dwarvish/Elvish Alliance",
      "address": "1234 Highway 64 NW, Georgetown, IN 47122",
      "acronym": "DEA",
      "types": ["Parachurch", "Mission"],
      "reach": ["Global"]
    },
    {
      "name": "The Buckland Organization",
      "address": "22 Peachtree Drive, Windsor Mill, MD 21244",
      "acronym": "BO",
      "types": ["Alliance", "Mission", "Parachurch"],
      "reach": ["Local", "Global", "Regional"]
    },
    {
      "name": "Fellowship of Halfing Languages",
      "address": "45 W. Southampton Dr., Eastpointe, MI 48021",
      "acronym": "FAHL",
      "types": ["Alliance"],
      "reach": ["Local", "National"]
    },
    {
      "name": "Rivers and Mountains Translation Group",
      "address": "738 Trout Street, Hollywood, FL 33020",
      "acronym": "RMTG",
      "types": ["Church", "Mission"],
      "reach": ["Local", "Regional"]
    },
    {
      "name": "Hobbiton Ministry",
      "address": "659 Cherry Hill Ave., Parkville, MD 21234",
      "acronym": "HM",
      "types": ["Church", "Mission"],
      "reach": ["National", "Regional"]
    },
    {
      "name": "Linguistics Seminary of Sutherland",
      "address": "46 Thatcher St., Port Jefferson Station, NY 11776",
      "acronym": "LSS",
      "types": ["Church"],
      "reach": ["National", "Regional", "Global"]
    },
    {
      "name": "Heart and Minds Across Belegaer",
      "address": "9766 W. Hawthorne Avenue, Strongsville, OH 44136",
      "acronym": "HMAB",
      "types": ["Church", "Mission"],
      "reach": ["National", "Regional"]
    },
    {
      "name": "The Gray Havens Initiative",
      "address": "6 S. Shore Circle, Thornton, CO 80241",
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
        address := <str>organization['address'],
        acronym := <str>organization['acronym'],
        types := <str>json_array_unpack(organization['types']),
        reach := <str>json_array_unpack(organization['reach'])
      })
    )
  ),
  new := (select organizations filter .createdAt = datetime_of_statement())
select { `Added Organizations` := new.name }
filter count(new) > 0;
