with
produciblesJson := to_json('[
  {
    "type": "EthnoArt",
    "name": "Far over the Misty Mountains Cold song",
    "scripture": {
      "label": "Exodus",
      "verses": [{
        "label": "Exodus",
        "start": {
          "book": "Exodus",
          "chapter": 19,
          "verse": 1,
          "verseId": 2027
        },
        "end": {
          "book": "Exodus",
          "chapter": 20,
          "verse": 26,
          "verseId": 2077
        }
      }]
    }
  },
  {
    "type": "EthnoArt",
    "name": "Song of Beren and Lúthien"
  },
  {
    "type": "EthnoArt",
    "name": "Song of Eärendil"
  },
  {
    "type": "Film",
    "name": "3 movies of the Lord of the Rings trilogy",
    "scripture": {
      "label": "Philemon",
      "verses": [{
        "label": "Philemon",
        "start": {
          "book": "Philemon",
          "chapter": 1,
          "verse": 1,
          "verseId": 29939
        },
        "end": {
          "book": "Philemon",
          "chapter": 1,
          "verse": 25,
          "verseId": 29963
        }
      }]
    }
  },
  {
    "type": "Film",
    "name": "3 movies of The Hobbit trilogy"
  },
  {
    "type": "Film",
    "name": "1 movie of the making of Lord of the Rings trilogy and the Hobbit"
  },
  {
    "type": "Story",
    "name": "9 Rings of power were given to Men",
    "scripture": {
      "label": "Jude",
      "verses": [{
        "label": "Jude",
        "start": {
          "book": "Jude",
          "chapter": 1,
          "verse": 1,
          "verseId": 30673
        },
        "end": {
          "book": "Jude",
          "chapter": 1,
          "verse": 25,
          "verseId": 30697
        }
      }]
    }
  },
  {
    "type": "Story",
    "name": "3 Rings of power were given to Elves"
  },
  {
    "type": "Story",
    "name": "7 Rings of power were given to Dwarves"
  }
]'),
newProduciblesInput := (for p in json_array_unpack(produciblesJson) union (
  select p if not exists (
    select Producible filter .name = <str>p['name']
      and str_replace(.__type__.name, 'default::', '') = <str>p['type']
  ) else {}
)),
newProducibles := (
  for producible in newProduciblesInput union (
    with scripture := if (select exists json_get(producible, 'scripture')) then (
      insert Scripture::Collection {
        label := <str>producible['scripture']['label'],
        verses := (
          for verseRange in json_array_unpack(producible['scripture']['verses']) union (
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
            ),
          })
        )
      }
    ) else {}
    select (
      if producible['type'] = <json>'EthnoArt' then (
        insert EthnoArt {
          name := <str>producible['name'],
          scripture := scripture
        }
      ) else if producible['type'] = <json>'Film' then (
        insert Film {
          name := <str>producible['name'],
          scripture := scripture
        }
      ) else (
        insert Story {
          name := <str>producible['name'],
          scripture := scripture
        }
      )
    )
  )
),
select { `Added Producibles` :=
  str_replace(newProducibles.__type__.name, 'default::', '') ++ ': ' ++ newProducibles.name
}
filter count(newProducibles) > 0;
