CREATE MIGRATION m1xftmn4ob3vc4ajtrn4kqtggwisgam2z6setwni7acbolvwicxt3q
    ONTO m1xzy4deu3w7kduilieoiydxysopymo7skj4sftggjen4vi3og6kaq
{
  CREATE MODULE Post IF NOT EXISTS;
  CREATE ABSTRACT TYPE Mixin::Embedded {
      CREATE REQUIRED SINGLE LINK container: default::Resource;
  };
  CREATE SCALAR TYPE Post::Shareability EXTENDING enum<Membership, Internal, AskToShareExternally, External>;
  CREATE SCALAR TYPE Post::Type EXTENDING enum<Note, Story, Prayer>;
  CREATE TYPE default::Post EXTENDING default::Resource, Mixin::Embedded, Mixin::Owned {
      CREATE REQUIRED PROPERTY body: std::json;
      CREATE REQUIRED PROPERTY shareability: Post::Shareability;
      CREATE REQUIRED PROPERTY type: Post::Type;
  };
  CREATE ABSTRACT TYPE Mixin::Postable EXTENDING default::Resource;
  ALTER TYPE default::Post {
      ALTER LINK container {
          SET SINGLE;
          ON TARGET DELETE DELETE SOURCE;
          SET OWNED;
          SET REQUIRED;
          SET TYPE Mixin::Postable USING (<Mixin::Postable>{});
      };
      CREATE SINGLE PROPERTY isMember := (.container[IS Project::ContextAware].isMember);
      CREATE SINGLE PROPERTY sensitivity := (.container[IS Project::ContextAware].sensitivity);
  };
  ALTER TYPE Mixin::Postable {
      CREATE LINK posts := (.<container[IS default::Post]);
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
