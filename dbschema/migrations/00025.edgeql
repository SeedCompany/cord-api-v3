CREATE MIGRATION m1b277rn3kn27wwnljx5nr3sgzyaxnx2mfzwq6audnkcifswhyq5ja
    ONTO m175xjn2wd5kwp5rqzuhwvnorgz56d5okl3x3zxiogsdlbzp23mh4a
{
  CREATE MODULE Auth IF NOT EXISTS;
  CREATE ABSTRACT TYPE Mixin::Timestamped {
      CREATE REQUIRED PROPERTY createdAt: std::datetime {
          SET default := (std::datetime_of_statement());
          SET readonly := true;
      };
  };
  ALTER TYPE default::Resource {
      ALTER PROPERTY modifiedAt {
          DROP REWRITE
              UPDATE ;
          };
      };
  ALTER TYPE default::Resource {
      DROP PROPERTY modifiedAt;
      EXTENDING Mixin::Timestamped LAST;
      ALTER PROPERTY createdAt {
          RESET OPTIONALITY;
          DROP OWNED;
          RESET TYPE;
      };
  };
  ALTER TYPE Mixin::Timestamped {
      CREATE REQUIRED PROPERTY modifiedAt: std::datetime {
          SET default := (std::datetime_of_statement());
          CREATE REWRITE
              UPDATE 
              USING (std::datetime_of_statement());
      };
  };
  CREATE TYPE Auth::EmailToken EXTENDING Mixin::Timestamped {
      CREATE REQUIRED PROPERTY email: std::str;
      CREATE INDEX ON (.email);
      CREATE REQUIRED PROPERTY token: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  CREATE TYPE Auth::Identity {
      CREATE REQUIRED PROPERTY passwordHash: std::str;
  };
  ALTER TYPE Auth::Identity {
      CREATE REQUIRED LINK user: default::User {
          ON TARGET DELETE DELETE SOURCE;
          CREATE CONSTRAINT std::exclusive;
      };
  };
  CREATE TYPE Auth::Session EXTENDING Mixin::Timestamped {
      CREATE LINK user: default::User {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED PROPERTY token: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  CREATE TYPE default::FundingAccount EXTENDING default::Resource, Mixin::Named {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED PROPERTY accountNumber: std::int16 {
          CREATE CONSTRAINT std::max_value(9);
          CREATE CONSTRAINT std::min_value(0);
      };
  };
};
