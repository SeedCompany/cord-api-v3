with
  usersJson := to_json('[
    {
      "email": "bilbo.baggins@faker.me",
      "realFirstName": "Bilbo",
      "realLastName": "Baggins",
      "phone": "555-555-5555",
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
      "phone": "555-555-5555",
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
      "phone": "555-555-5555",
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
      "phone": "555-555-5555",
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
      "phone": "555-555-5555",
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
      "phone": "555-555-5555",
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
      "phone": "555-555-5555",
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
      (with
        roles := <default::Role> json_array_unpack(user['roles']),
        newEducation := (
          for edu in json_array_unpack(user['education'])
          union (
            insert User::Education {
              degree := <User::Degree>edu['degree'],
              major := <str>edu['major'],
              institution := <str>edu['institution']
            }
          )
        ),
        insert User {
          email := <str>user['email'],
          realFirstName := <str>user['realFirstName'],
          realLastName := <str>user['realLastName'],
          phone := <str>user['phone'],
          about := <str>user['about'],
          roles := roles,
          title := <str>user['title'],
          education := newEducation
        }
      )
    )
  )
select users;
