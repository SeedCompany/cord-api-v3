CREATE MIGRATION m1v6vmh2owlqk4hmin44txizh64lrl6xjo4rlay4gyfk3sjskyqe2q
    ONTO m1yqrqv3p2ejs6crcj32nafkikyoj67b2gfwhola6nyjhndffjzmfq
{
  CREATE ABSTRACT TYPE Project::ContextAware {
      CREATE REQUIRED LINK projectContext: Project::Context;
      CREATE OPTIONAL PROPERTY ownSensitivity: default::Sensitivity {
          CREATE ANNOTATION std::description := "A writable source of a sensitivity. This doesn't necessarily mean it be the same as .sensitivity, which is what is used for authorization.";
      };
      CREATE ANNOTATION std::description := 'A type that has a project context, which allows it to be\n      aware of the sensitivity & current user membership for the associated context.';
  };
  ALTER TYPE Project::Resource {
      DROP EXTENDING Project::HasContext;
      EXTENDING Project::ContextAware LAST;
  };
  ALTER TYPE default::Project {
      DROP EXTENDING Project::HasContext;
      EXTENDING Project::ContextAware BEFORE Mixin::Pinnable;
  };
  ALTER TYPE Project::ContextAware {
      CREATE REQUIRED SINGLE PROPERTY isMember := (EXISTS (.projectContext.projects.membership));
      CREATE REQUIRED SINGLE PROPERTY sensitivity := ((std::max(.projectContext.projects.ownSensitivity) ?? (.ownSensitivity ?? default::Sensitivity.High)));
  };
  ALTER TYPE Ethnologue::Language {
      DROP EXTENDING Project::HasContext;
      EXTENDING Project::ContextAware LAST;
  };
  ALTER TYPE default::Language {
      DROP EXTENDING Project::HasContext;
      EXTENDING Project::ContextAware BEFORE Mixin::Pinnable;
  };
  DROP TYPE Project::HasContext;
};
