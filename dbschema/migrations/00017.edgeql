CREATE MIGRATION m1yqrqv3p2ejs6crcj32nafkikyoj67b2gfwhola6nyjhndffjzmfq
    ONTO m1qxegbs7vzamuvsv7cs6r4nntxkwayrdhdlkx3223iyq3hsidd3ga
{
  ALTER TYPE Project::HasContext {
      ALTER LINK projectContext {
          RESET default;
      };
      ALTER PROPERTY ownSensitivity {
          CREATE ANNOTATION std::description := "A writable source of a sensitivity. This doesn't necessarily mean it be the same as .sensitivity, which is what is used for authorization.";
      };
  };
  ALTER TYPE Project::Resource {
      CREATE LINK projectContext: Project::Context {
          SET REQUIRED USING (<Project::Context>{});
      };
  };
  ALTER TYPE Project::Resource {
      DROP PROPERTY isMember;
      EXTENDING Project::HasContext LAST;
      ALTER LINK projectContext {
          RESET OPTIONALITY;
          DROP OWNED;
          RESET TYPE;
      };
  };
  ALTER TYPE Project::Resource {
      CREATE TRIGGER enforceCorrectProjectContext
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((__new__.project IN __new__.projectContext.projects), message := 'Given project must be in given project context'));
  };
  ALTER TYPE Project::Context {
      CREATE ANNOTATION std::description := 'A type that holds a reference to a list of projects. This allows multiple objects to hold a reference to the same list. For example, Language & Ethnologue::Language share the same context / project list.';
  };
  ALTER TYPE default::Project {
      ALTER LINK projectContext {
          SET default := (INSERT
              Project::Context
          );
          SET OWNED;
          SET TYPE Project::Context;
      };
  };
  ALTER TYPE default::Language {
      ALTER LINK projectContext {
          SET default := (INSERT
              Project::Context
          );
          SET OWNED;
          SET TYPE Project::Context;
      };
  };
};
