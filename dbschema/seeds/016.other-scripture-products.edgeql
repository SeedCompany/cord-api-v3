with
productsJson := to_json($$[
  {
    "project": "South Downs",
    "title": "Recording of Lamentations",
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
    "describeCompletion": "Published digitally as a video on social media sites and as pdf text distributed by text messaging.",
    "progressTarget": 1,
    "progressStepMeasurement": "Boolean"
  },
  {
    "project": "Misty Mountains",
    "title":  "2 plays",
    "description": "Two plays depicting the good ol' days of the Misty Mountains",
    "mediums": ["Web", "Video", "Audio", "App"],
    "steps": ["Completed"],
    "methodology": "Film",
    "describeCompletion": "Published digitally as text, audio, and video on a website, in the Dwarvish Leader app and on social media sites.",
    "progressTarget": 2,
    "progressStepMeasurement": "Number"
  }
]$$),

products := (
  for entry in json_array_unpack(productsJson)
  union (
    with engagement := assert_single((select Engagement filter .project.name = <str>entry['project']))
    select (
      (select OtherProduct filter .engagement = engagement and .title = <str>entry['title']) ??
      (insert OtherProduct {
        project := engagement.project,
        projectContext := engagement.projectContext,
        engagement := engagement,
        title := <str>entry['title'],
        description := <str>json_get(entry, 'description'),
        mediums := <str>json_array_unpack(json_get(entry, 'mediums')),
        purposes := <str>json_array_unpack(json_get(entry, 'purposes')),
        steps := <str>json_array_unpack(json_get(entry, 'steps')),
        methodology := <Product::Methodology>json_get(entry, 'methodology'),
        describeCompletion := <str>json_get(entry, 'describeCompletion'),
        progressTarget := <int16>entry['progressTarget'],
        progressStepMeasurement := <str>entry['progressStepMeasurement']
      })
    )
  )
),

new := (select products filter .createdAt = datetime_of_statement())
select { `Added Other Products` := new.project.name ++ ': ' ++ new.title }
filter count(new) > 0;
