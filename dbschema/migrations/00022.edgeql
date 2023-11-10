CREATE MIGRATION m1kwmpnrei2jr2g5jm6cglifrryeelf6oo4p6v7on4qslj2dsd7cja
    ONTO m1c5l3sqykj5an6vd6jjfgzpiax2hg5mpnu5gl2jrovvrb6q2oglia
{
  CREATE MODULE File IF NOT EXISTS;
  CREATE MODULE Location IF NOT EXISTS;
  CREATE FUNCTION default::str_clean(string: std::str) -> OPTIONAL std::str USING (WITH
      trimmed := 
          std::str_trim(string, ' \t\r\n')
  SELECT
      (IF (std::len(trimmed) > 0) THEN trimmed ELSE <std::str>{})
  );
  CREATE ABSTRACT TYPE Mixin::Named {
      CREATE REQUIRED PROPERTY name: std::str {
          CREATE REWRITE
              INSERT 
              USING (default::str_clean(.name));
          CREATE REWRITE
              UPDATE 
              USING (default::str_clean(.name));
      };
      CREATE INDEX ON (default::str_sortable(.name));
  };
  CREATE ABSTRACT TYPE File::Node EXTENDING default::Resource, Mixin::Named {
      CREATE REQUIRED LINK createdBy: default::User {
          SET default := (<default::User>GLOBAL default::currentUserId);
      };
      CREATE REQUIRED LINK modifiedBy: default::User {
          SET default := (<default::User>GLOBAL default::currentUserId);
          CREATE REWRITE
              UPDATE 
              USING (<default::User>GLOBAL default::currentUserId);
      };
      CREATE LINK parent: File::Node;
      CREATE MULTI LINK parents: File::Node {
          CREATE PROPERTY depth: std::int16;
      };
      CREATE PROPERTY public: std::bool;
      CREATE REQUIRED PROPERTY size: std::int64;
  };
  CREATE TYPE File::Version EXTENDING File::Node {
      CREATE REQUIRED PROPERTY mimeType: std::str;
  };
  CREATE TYPE default::Directory EXTENDING File::Node {
      CREATE REQUIRED PROPERTY totalFiles: std::int32 {
          SET default := 0;
      };
  };
  CREATE TYPE default::File EXTENDING File::Node {
      CREATE REQUIRED PROPERTY mimeType: std::str;
  };
  CREATE TYPE default::FieldRegion EXTENDING default::Resource, Mixin::Named {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED LINK director: default::User;
  };
  CREATE TYPE default::FieldZone EXTENDING default::Resource, Mixin::Named {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED LINK director: default::User;
  };
  ALTER TYPE default::Project {
      EXTENDING Mixin::Named BEFORE Mixin::Pinnable;
      ALTER PROPERTY name {
          RESET OPTIONALITY;
          RESET TYPE;
      };
      CREATE LINK rootDirectory: default::Directory;
  };
  ALTER TYPE default::Language {
      EXTENDING Mixin::Named BEFORE Mixin::Pinnable;
      ALTER PROPERTY name {
          RESET OPTIONALITY;
      };
      ALTER INDEX ON (default::str_sortable(.name)) DROP OWNED;
  };
  CREATE SCALAR TYPE Location::IsoAlpha3Code EXTENDING std::str {
      CREATE CONSTRAINT std::regexp('^[A-Z]{3}$');
  };
  CREATE SCALAR TYPE Location::Type EXTENDING enum<Country, City, County, Region, State, CrossBorderArea>;
  CREATE TYPE default::Location EXTENDING default::Resource, Mixin::Named {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE LINK mapImage: default::File;
      CREATE PROPERTY isoAlpha3: Location::IsoAlpha3Code {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED PROPERTY type: Location::Type;
  };
  ALTER TYPE default::Project {
      CREATE TRIGGER enforceContext
          AFTER UPDATE 
          FOR EACH DO (std::assert(((__new__ IN __new__.projectContext.projects) AND (std::count(__new__.projectContext.projects) = 1)), message := "A Project's own context should be itself (no more or less)"));
  };
  ALTER TYPE default::Language {
      ALTER PROPERTY name {
          DROP OWNED;
          RESET TYPE;
      };
  };
  ALTER TYPE default::FieldRegion {
      CREATE REQUIRED LINK fieldZone: default::FieldZone;
  };
  ALTER TYPE default::FieldZone {
      CREATE LINK fieldRegions := (.<fieldZone[IS default::FieldRegion]);
  };
  ALTER TYPE default::InternshipEngagement {
      CREATE LINK growthPlan: default::File;
      CREATE LINK countryOfOrigin: default::Location;
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE LINK pnp: default::File;
  };
};
