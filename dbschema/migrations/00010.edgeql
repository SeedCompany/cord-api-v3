CREATE MIGRATION m1bl5usbsd57f2obaikame74dp7p3oitsmulfitpvducp2k4oetwea
    ONTO m1kgkikeo6qaen7zzrnuhvhfiqak32ap254imd6or7naaatelnf24q
{
  ALTER TYPE Project::Resource {
      DROP PROPERTY isMember;
  };
  CREATE TYPE Project::Context;
  CREATE ABSTRACT TYPE Project::HasContext {
      CREATE REQUIRED LINK projectContext: Project::Context {
          SET default := (INSERT
              Project::Context
          );
      };
      CREATE PROPERTY ownSensitivity: default::Sensitivity;
  };
  ALTER TYPE default::Language {
      DROP PROPERTY isMember;
  };
  ALTER TYPE default::Project {
      DROP PROPERTY isMember;
      EXTENDING Project::HasContext LAST;
  };
  ALTER TYPE Project::Context {
      CREATE MULTI LINK projects: default::Project {
          ON TARGET DELETE ALLOW;
      };
  };
  ALTER TYPE Project::HasContext {
      CREATE REQUIRED SINGLE PROPERTY isMember := (EXISTS (.projectContext.projects.membership));
  };
  ALTER TYPE default::Project {
      ALTER PROPERTY ownSensitivity {
          RESET OPTIONALITY;
          RESET TYPE;
      };
  };
  ALTER TYPE Project::Resource {
      CREATE PROPERTY isMember := (.project.isMember);
  };
  ALTER TYPE Project::HasContext {
      CREATE REQUIRED SINGLE PROPERTY sensitivity := ((std::max(.projectContext.projects.ownSensitivity) ?? (.ownSensitivity ?? default::Sensitivity.High)));
  };
  ALTER TYPE default::Language {
      CREATE PROPERTY isMember := (EXISTS (.projects.isMember));
  };
};
