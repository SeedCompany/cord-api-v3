with
  usersJson := to_json('[
    {
      "email": "bilbo.baggins@faker.me",
      "realFirstName": "Bilbo",
      "realLastName": "Baggins",
      "about": "A halfling from the Shire",
      "roles": ["ProjectManager"],
      "title": "Halfling Manager",
      "education": [
        {
          "degree": "Bachelors",
          "major": "Unlikely Heroics",
          "institution": "Shire University"
        }
      ]
    },
    {
      "email": "frodo.baggins@faker.me",
      "realFirstName": "Frodo",
      "realLastName": "Baggins",
      "about": "The nephew of a halfling from the Shire",
      "roles": ["FinancialAnalyst"],
      "title": "Jewlery Steward",
      "education": [
        {
          "degree": "Bachelors",
          "major": "Unlikely Heroics",
          "institution": "Shire University"
        },
        {
          "degree": "Masters",
          "major": "Determination Tactics",
          "institution": "Shire University"
        }
      ]
    },
    {
      "email": "gray.pilgrim@faker.me",
      "realFirstName": "Gandalf",
      "realLastName": "The Gray",
      "about": "A wizard of Ainur",
      "roles": ["Controller"],
      "title": "Mithrandir of Middle Earth",
      "education": [
        {
          "degree": "Doctorate",
          "major": "Wizardry Proper",
          "institution": "Timeless Halls"
        }
      ]
    },
    {
      "email": "samwise.gamgee@faker.me",
      "realFirstName": "Samwise",
      "realLastName": "Gamgee",
      "about": "A gardening halfing.",
      "roles": ["ConsultantManager"],
      "title": "Son of the Gaffer",
      "education": [
        {
          "degree": "Bachelors",
          "major": "Arboriculture",
          "institution": "Shire University"
        }
      ]
    },
    {
      "email": "meriadoc.brandybuck@faker.me",
      "realFirstName": "Meriadoc",
      "realLastName": "Brandybuck",
      "about": "A halfling friend",
      "roles": ["Controller"],
      "title": "Holdwine of the Shire",
      "education": [
        {
          "degree": "Bachelors",
          "major": "Unexpected Bravery",
          "institution": "Shire University"
        }
      ]
    },
    {
      "email": "peregrin.took@faker.me",
      "realFirstName": "Peregrin",
      "realLastName": "Took",
      "about": "A halfing of mild mischief.",
      "roles": ["RegionalDirector"],
      "title": "Master of Curiousity",
      "education": [
        {
          "degree": "Bachelors",
          "major": "Culinary Arts",
          "institution": "Shire University"
        }
      ]
    },
    {
      "email": "aragorn.two@faker.me",
      "realFirstName": "Aragorn",
      "realLastName": "Son of Arathorn",
      "about": "A human of the Dunedain.",
      "roles": ["Leadership"],
      "title": "King of Gondor and Arnor",
      "education": [
        {
          "degree": "Bachelors",
          "major": "Leadership",
          "institution": "Rivendell University"
        },
        {
          "degree": "Masters",
          "major": "Swordsmanship",
          "institution": "Rivendell University"
        }
      ]
    }
  ]'),
  users := (
    for user in json_array_unpack(usersJson)
    union (
      (select User filter .email = <str>user['email']) ??
      (insert User {
        email := <str>user['email'],
        realFirstName := <str>user['realFirstName'],
        realLastName := <str>user['realLastName'],
        phone := '555-555-5555',
        about := <str>user['about'],
        roles := <str>json_array_unpack(user['roles']),
        title := <str>user['title'],
        education := (
          for edu in json_array_unpack(user['education'])
          union (
            insert User::Education {
              degree := <str>edu['degree'],
              major := <str>edu['major'],
              institution := <str>edu['institution']
            }
          )
        )
      })
    )
  ),
  new := (select users filter .createdAt = datetime_of_statement())
select { `Added Users` := new.realFirstName ++ ' ' ++ new.realLastName }
filter count(new) > 0;
