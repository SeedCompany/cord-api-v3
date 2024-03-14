CREATE MIGRATION m1dtvcrlfunyjcbw3b7ojqencgpo3cs77jzgkwdjvgkg2gxa7frz4q
    ONTO m1f2vgmwgreou5bz2365deujfwkgiot4xif2wpligb7efkgywb4gwq
{
  CREATE MODULE Comments IF NOT EXISTS;
  CREATE ABSTRACT TYPE Comments::Aware EXTENDING default::Resource;
  ALTER TYPE default::Project EXTENDING Comments::Aware BEFORE default::Resource;
  CREATE TYPE Comments::Thread EXTENDING default::Resource, Mixin::Embedded, Mixin::Owned {
      ALTER LINK container {
          SET SINGLE;
          ON TARGET DELETE DELETE SOURCE;
          SET OWNED;
          SET REQUIRED;
          SET TYPE Comments::Aware USING (<Comments::Aware>{});
      };
  };
  ALTER TYPE Comments::Aware {
      CREATE LINK commentThreads := (.<container[IS Comments::Thread]);
  };
  CREATE TYPE Comments::Comment EXTENDING default::Resource, Mixin::Owned {
      CREATE REQUIRED LINK thread: Comments::Thread {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED PROPERTY body: default::RichText;
  };
  ALTER TYPE Comments::Thread {
      CREATE LINK comments := (.<thread[IS Comments::Comment]);
      CREATE LINK firstComment := (SELECT
          .comments ORDER BY
              .createdAt ASC
      LIMIT
          1
      );
      CREATE LINK latestComment := (SELECT
          .comments ORDER BY
              .createdAt DESC
      LIMIT
          1
      );
  };
};
