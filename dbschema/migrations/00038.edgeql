CREATE MIGRATION m1wdw2srbtq3ondtyuhcobwgcbdawourtp4vcapedti3kca2wh46dq
    ONTO m1xzy4deu3w7kduilieoiydxysopymo7skj4sftggjen4vi3og6kaq
{
  CREATE MODULE Post IF NOT EXISTS;
  CREATE ABSTRACT TYPE Mixin::Embedded {
      CREATE REQUIRED SINGLE LINK container: default::Resource;
  };
  CREATE SCALAR TYPE Post::Shareability EXTENDING enum<Membership, Internal, AskToShareExternally, External>;
  CREATE SCALAR TYPE Post::Type EXTENDING enum<Note, Story, Prayer>;
  CREATE TYPE default::Post EXTENDING default::Resource, Mixin::Embedded, Mixin::Owned {
      ALTER LINK container {
          SET SINGLE;
          ON TARGET DELETE DELETE SOURCE;
          SET OWNED;
          SET REQUIRED;
      };
      CREATE SINGLE PROPERTY isMember := (.container[IS Project::ContextAware].isMember);
      CREATE SINGLE PROPERTY sensitivity := (.container[IS Project::ContextAware].sensitivity);
      CREATE REQUIRED PROPERTY body: std::json;
      CREATE REQUIRED PROPERTY shareability: Post::Shareability;
      CREATE REQUIRED PROPERTY type: Post::Type;
  };
  CREATE ABSTRACT TYPE Mixin::Postable EXTENDING default::Resource {
      CREATE LINK posts := (.<container[IS default::Post]);
  };
  ALTER TYPE default::Post {
      CREATE TRIGGER enforcePostable
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((__new__.container IS Mixin::Postable), message := "A Post's container must be a Postable"));
  };
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY chapter {
          DROP CONSTRAINT std::min_value(1);
      };
  };
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY chapter {
          CREATE CONSTRAINT std::min_value(1);
      };
  };
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY verse {
          DROP CONSTRAINT std::min_value(1);
      };
  };
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY verse {
          CREATE CONSTRAINT std::min_value(1);
      };
  };
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY verseId {
          DROP CONSTRAINT std::min_value(0);
      };
  };
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY verseId {
          CREATE CONSTRAINT std::min_value(0);
      };
  };
  ALTER TYPE default::FundingAccount {
      ALTER PROPERTY accountNumber {
          DROP CONSTRAINT std::min_value(0);
      };
  };
  ALTER TYPE default::FundingAccount {
      ALTER PROPERTY accountNumber {
          CREATE CONSTRAINT std::min_value(0);
      };
  };
  ALTER TYPE default::Project {
      ALTER PROPERTY departmentId {
          DROP CONSTRAINT std::min_value(10000);
      };
  };
  ALTER TYPE default::Project {
      ALTER PROPERTY departmentId {
          CREATE CONSTRAINT std::min_value(10000);
      };
  };
  ALTER SCALAR TYPE default::population {
      DROP CONSTRAINT std::min_value(0);
  };
  ALTER SCALAR TYPE default::population {
      CREATE CONSTRAINT std::min_value(0);
  };
};
