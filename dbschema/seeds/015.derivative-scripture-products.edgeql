with
productsJson := to_json('[
  {
    "project": "Misty Mountains",
    "produces": "Far over the Misty Mountains Cold song",
    "mediums": ["Audio"],
    "purposes": ["EvangelismChurchPlanting", "Discipleship"],
    "steps": ["Craft", "Record", "Completed"],
    "methodology": "OtherOralStories",
    "describeCompletion": "1 song recorded and published online",
    "progressTarget": 100,
    "progressStepMeasurement": "Percent",
    "totalVerses": 51,
    "totalVerseEquivalents": 51
  },
  {
    "project": "Arnor Lake",
    "produces": "Song of Eärendil",
    "mediums": ["Audio"],
    "purposes": ["ChurchLife", "ChurchMaturity", "Discipleship"],
    "steps": ["Craft", "Test", "Check", "Record"],
    "methodology": "OtherOralStories",
    "progressTarget": 100,
    "progressStepMeasurement": "Percent"
  },
  {
    "project": "Lothlorien",
    "produces": "3 Rings of power were given to Elves"
  },
  {
    "project": "Emyn Muil",
    "produces": "Song of Beren and Lúthien",
    "scriptureOverride": {
      "label": "Song of Solomon",
      "verses": [
        {
          "label": "Song of Solomon",
          "start": {
            "book": "Song of Solomon",
            "chapter": 1,
            "verse": 1,
            "verseId": 17538
          },
          "end": {
            "book": "Song of Solomon",
            "chapter": 8,
            "verse": 14,
            "verseId": 17654
          }
        }
      ]
    },
    "totalVerses": 117,
    "totalVerseEquivalents": 146
  },
  {
    "project": "South Downs",
    "produces": "3 movies of the Lord of the Rings trilogy",
    "mediums": ["Other", "Web"],
    "steps": ["Translate", "Completed"],
    "methodology": "Film",
    "describeCompletion": "Released in theaters and only",
    "progressTarget": 100,
    "progressStepMeasurement": "Percent"
  },
  {
    "project": "South Downs",
    "produces": "3 movies of The Hobbit trilogy",
    "scriptureOverride": {
      "label": "Lamentations",
      "verses": [
        {
          "label": "Lamentations",
          "start": {
            "book": "Lamentations",
            "chapter": 1,
            "verse": 1,
            "verseId": 1111
          },
          "end": {
            "book": "Lamentations",
            "chapter": 5,
            "verse": 22,
            "verseId": 1112
          }
        }
      ]
    },
    "progressTarget": 100,
    "progressStepMeasurement": "Percent",
    "totalVerses": 154,
    "totalVerseEquivalents": 154
  },
  {
    "project": "Lothlorien",
    "produces": "1 movie of the making of Lord of the Rings trilogy and the Hobbit"
  },
  {
    "project": "Misty Mountains",
    "produces": "7 Rings of power were given to Dwarves",
    "steps": ["Craft", "Test", "Check", "Completed"],
    "methodology": "Craft2Tell",
    "progressTarget": 100,
    "progressStepMeasurement": "Percent"
  }
]'),

products := (
  for entry in json_array_unpack(productsJson)
  union (
    with
      engagement := assert_single((select Engagement filter .project.name = <str>entry['project'])),
      produces := assert_single((select Producible filter .name = <str>entry['produces']))
    select (
      (select DerivativeScriptureProduct
        filter .engagement = engagement
          and .produces = produces
          and .scriptureOverride.label ?= <str>json_get(entry, 'scriptureOverride', 'label')
      ) ??
      (insert DerivativeScriptureProduct {
        project := engagement.project,
        projectContext := engagement.projectContext,
        engagement := engagement,
        scriptureOverride := if (exists json_get(entry, 'scriptureOverride')) then (
          insert Scripture::Collection {
            label := <str>entry['scriptureOverride']['label'],
            verses := (
              for verseRange in json_array_unpack(entry['scriptureOverride']['verses'])
              union (
                insert Scripture::VerseRange {
                  label := <str>verseRange['label'],
                  `start` := (
                    insert Scripture::Verse {
                      book := <str>verseRange['start']['book'],
                      chapter := <int16>verseRange['start']['chapter'],
                      verse := <int16>verseRange['start']['verse'],
                      verseId := <int16>verseRange['start']['verseId']
                    }
                  ),
                  `end` := (
                    insert Scripture::Verse {
                      book := <str>verseRange['end']['book'],
                      chapter := <int16>verseRange['end']['chapter'],
                      verse := <int16>verseRange['end']['verse'],
                      verseId := <int16>verseRange['end']['verseId']
                    }
                  )
                }
              )
            )
          }
        ) else {},
        produces := produces,
        mediums := <str>json_array_unpack(json_get(entry, 'mediums')),
        purposes := <str>json_array_unpack(json_get(entry, 'purposes')),
        steps := <str>json_array_unpack(json_get(entry, 'steps')),
        methodology := <Product::Methodology>json_get(entry, 'methodology'),
        describeCompletion := <str>json_get(entry, 'describeCompletion'),
        placeholderDescription := <str>json_get(entry, 'placeholderDescription'),
        pnpIndex := <int16>json_get(entry, 'pnpIndex'),
        progressTarget := <int16>json_get(entry, 'progressTarget'),
        progressStepMeasurement := <str>json_get(entry, 'progressStepMeasurement'),
        totalVerses := <int16>json_get(entry, 'totalVerses'),
        totalVerseEquivalents := <float32>json_get(entry, 'totalVerseEquivalents')
      })
    )
  )
),

new := (select products filter .createdAt = datetime_of_statement())
select {
  `Added Derivative Scripture Products` :=
    new.project.name ++ ': ' ++ new.produces.name
}
filter count(new) > 0;
