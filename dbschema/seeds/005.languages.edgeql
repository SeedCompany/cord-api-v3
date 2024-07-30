with
  languagesJson := to_json('[
    {
      "name": "English",
      "displayNamePronunciation": "[ENG-lish]",
      "sensitivity": "Low",
      "registryOfDialectsCode": "00120",
      "populationOverride": 100000,
      "ethnologue": {
        "code": "eng",
        "population": 500000
      }
    },
    {
      "name": "Quenya",
      "displayNamePronunciation": "[KWEN-ya]",
      "sensitivity": "Medium",
      "registryOfDialectsCode": "99931",
      "populationOverride": 500000,
      "leastOfThese": true,
      "ethnologue": {
        "code": "kwn",
        "population": 1000000
      }
    },
    {
      "name": "Sindarin",
      "displayNamePronunciation": "[sin-DAR-in]",
      "sensitivity": "Medium",
      "registryOfDialectsCode": "12345",
      "hasExternalFirstScripture": true,
      "ethnologue": {
        "code": "sdn",
        "provisionalCode": "sdi",
        "population": 700000
      }
    },
    {
      "name": "Khuzdul",
      "displayNamePronunciation": "[KUHZ-dul]",
      "sensitivity": "High",
      "registryOfDialectsCode": "22225",
      "leastOfThese": true,
      "hasExternalFirstScripture": true,
      "ethnologue": {
        "provisionalCode": "khu",
        "population": 9900000
      }
    },
    {
      "name": "Westron",
      "displayNamePronunciation": "[WEST-ron]",
      "sensitivity": "Low",
      "registryOfDialectsCode": "78910",
      "isSignLanguage": true,
      "signLanguageCode": "WT10",
      "ethnologue": {
        "code": "wst",
        "population": 1000
      }
    }
  ]'),
  languages := (
    for language in json_array_unpack(languagesJson)
    union (
      (select Language filter .name = <str>language['name']) ??
      (with
        ethnologue := language['ethnologue'],
        projectContext := (insert Project::Context),
        languageEntity := (insert Language {
          name := <str>language['name'],
          displayNamePronunciation := <str>language['displayNamePronunciation'],
          ownSensitivity := <Sensitivity>json_get(language, 'sensitivity'),
          isDialect := <bool>json_get(language, 'isDialect') ?? false,
          registryOfLanguageVarietiesCode := <str>json_get(language, 'registryOfLanguageVarietiesCode'),
          leastOfThese := <bool>json_get(language, 'leastOfThese') ?? false,
          isSignLanguage := exists json_get(language, 'signLanguageCode'),
          signLanguageCode := <str>json_get(language, 'signLanguageCode'),
          hasExternalFirstScripture := <bool>json_get(language, 'hasExternalFirstScripture') ?? false,
          populationOverride := <population>json_get(language, 'populationOverride'),
          projectContext := projectContext,
        }),
        ethnologueEntity := (insert Ethnologue::Language {
          language := languageEntity,
          ownSensitivity := <Sensitivity>json_get(language, 'sensitivity'),
          code := <Ethnologue::code>json_get(ethnologue, 'code'),
          provisionalCode := <Ethnologue::code>json_get(ethnologue, 'provisionalCode'),
          population := <population>json_get(ethnologue, 'population'),
          projectContext := projectContext,
        })
      select languageEntity)
    )
  ),
  new := (select languages filter .createdAt = datetime_of_statement())
select { `Added Languages` := new.name }
filter count(new) > 0;
