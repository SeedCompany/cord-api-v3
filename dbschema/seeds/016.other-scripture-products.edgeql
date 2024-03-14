with
  otherProductJson := to_json('[
  {
    "project": "South Downs",
    "title": "Recording of Lametations",
    "description": "To help them understand it better.",
    "mediums": ["Other"],
    "steps": ["Completed"],
    "progressTarget": 100,
    "progressStepMeasurement": "Percent"
  },
  {
    "project": "Misty Mountains",
    "title":  "7 new songs written and recorded",
    "mediums": ["Audio", "Web"],
    "steps": ["Completed"],
    "progressTarget": 100,
    "progressStepMeasurement": "Percent"
  },
  {
    "project": "Arnor Lake",
    "title":  "LOTR Stories",
    "description": "TBD",
    "mediums": ["TrainedStoryTellers"],
    "steps": ["Completed"],
    "progressTarget": 100,
    "progressStepMeasurement": "Percent"
  },
  {
    "project": "Emyn Muil",
    "title":  "Recording of Commentary for each LOTR film by Bryan N.",
    "description": "Just another day in paradise",
    "mediums": ["Audio"],
    "steps": ["Completed"],
    "progressTarget": 100,
    "progressStepMeasurement": "Percent"
  },
  {
    "project": "Emyn Muil",
    "title":  "Linguistic Research",
    "steps": ["Completed"],
    "methodology": "OtherWritten",
    "progressTarget": 1,
    "progressStepMeasurement": "Boolean"
  },
  {
    "project": "Lothlorien",
    "title":  "Video editing workshop",
    "description": "To help the team produce better videos",
    "mediums": ["Other"],
    "steps": ["Completed"],
    "progressTarget": 1,
    "progressStepMeasurement": "Boolean"
  },
  {
    "project": "Lothlorien",
    "title":  "An evangelistic tract for Drwarves translated from the Elvish.",
    "mediums": ["Video", "Web", "Other"],
    "methodology": "OtherWritten",
    "describeCompletion": "Completed = published digitally as a video on social media sites and as pdf text distributed by text messaging.",
    "progressTarget": 1,
    "progressStepMeasurement": "Boolean"
  },
  {
    "project": "Misty Mountains",
    "title":  "2 plays",
    "description": "Two plays dipicting the good ol\' days of the Misty Mountains",
    "mediums": ["Web", "Video", "Audio", "App"],
    "steps": ["Completed"],
    "methodology": "Film",
    "describeCompletion": "Completed = published digitally as text, audio, and video on a website, in the Dwarvish Leader app and on social media sites.",
    "progressTarget": 2,
    "progressStepMeasurement": "Number"
  }
  ]'),
  otherProducts := (
    for otherProduct in json_array_unpack(otherProductJson)
    union (
      with
        engagement := assert_single((select Engagement filter .project.name = <str>otherProduct['project'])),
      select (
        (select OtherProduct filter .engagement = engagement and .title = <str>otherProduct['title']) ??
        (insert OtherProduct {
          project := engagement.project,
          projectContext := engagement.projectContext,
          engagement := engagement,
          title := <str>otherProduct['title'],
          description := <str>json_get(otherProduct, 'description'),
          mediums := <str>json_array_unpack(json_get(otherProduct,'mediums')),
          purposes := <str>json_array_unpack(json_get(otherProduct,'purposes')),
          steps := <str>json_array_unpack(json_get(otherProduct,'steps')),
          methodology := <Product::Methodology>json_get(otherProduct,'methodology'),
          describeCompletion := <str>json_get(otherProduct,'describeCompletion'),
          progressTarget := <int16>otherProduct['progressTarget'],
          progressStepMeasurement := <str>otherProduct['progressStepMeasurement']
        })
      )
    )
  ),
  newOtherProducts := (select otherProducts filter .createdAt = datetime_of_statement())
select { `Added Other Products` := newOtherProducts.project.name ++ ': ' ++ newOtherProducts.title }
filter count(newOtherProducts) > 0;