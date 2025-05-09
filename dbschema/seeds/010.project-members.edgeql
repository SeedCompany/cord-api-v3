with
  projectMembersJson := to_json('[
    {
      "project": "Misty Mountains",
      "members": ["Bilbo", "Frodo"]
    },
    {
      "project": "Arnor Lake",
      "members": ["Bilbo", "Gandalf"]
    },
    {
      "project": "Lothlorien",
      "members": ["Bilbo"]
    },
    {
      "project": "Emyn Muil",
      "members": ["Bilbo", "Frodo", "Samwise", "Meriadoc", "Peregrin"]
    },
    {
      "project": "South Downs",
      "members": ["Bilbo", "Peregrin"]
    },
    {
      "project": "Glorfindel - Exegetical Facilitator",
      "members": ["Aragorn", "Samwise"]
    },
    {
      "project": "Arwen Evenstar Intern",
      "members": ["Gandalf", "Frodo"]
    },
    {
      "project": "Eomer of Rohan Intern",
      "members": ["Bilbo"]
    },
    {
      "project": "Cohort of the Ents",
      "members": ["Gandalf", "Meriadoc", "Peregrin"]
    },
    {
      "project": "Barliman Butterbur Intern",
      "members": ["Gandalf", "Meriadoc", "Peregrin", "Bilbo", "Frodo", "Samwise"]
    }
  ]'),
  newMembers := (
    for projectMembers in json_array_unpack(projectMembersJson)
    union (
      for member in json_array_unpack(projectMembers['members'])
      union (
        with
          existingUser := assert_single((select User filter .realFirstName = <str>member)),
          existingProject := assert_single((select Project filter .name = <str>projectMembers['project'])),
        select (
          (select Project::Member filter .user = existingUser and .project = existingProject) ??
          (insert Project::Member {
            user := existingUser,
            roles := existingUser.roles,
            project := existingProject,
            projectContext := existingProject.projectContext
          })
        )
      )
    )
  ),
  new := (select newMembers filter .createdAt = datetime_of_transaction())
select { `Added Project Members: Member -> Project`
  := new.user.realFirstName ++ ' ' ++ new.user.realLastName ++ ' -> ' ++ new.project.name }
filter count(new) > 0;
