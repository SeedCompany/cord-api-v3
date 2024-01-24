CREATE MIGRATION m1vzgo7d3slqdwhpmcigvmaxnh3cz7nhympvu7mb5g3beipzfve5tq
    ONTO m1zpp5l5wqgcm7hmcunnzswx6oivv7eh5gtwq5ysfaxlk5vhkfjieq
{
  CREATE ALIAS default::currentUser := (
      <default::User>GLOBAL default::currentUserId
  );
  ALTER TYPE File::Node {
      ALTER LINK createdBy {
          SET default := (default::currentUser);
      };
  };
  ALTER TYPE File::Node {
      ALTER LINK modifiedBy {
          SET default := (default::currentUser);
      };
  };
  ALTER TYPE Mixin::Owned {
      ALTER LINK owner {
          SET default := (default::currentUser);
      };
  };
  ALTER TYPE File::Node {
      ALTER LINK modifiedBy {
          DROP REWRITE
              UPDATE ;
          };
      };
  ALTER TYPE File::Node {
      ALTER LINK modifiedBy {
          CREATE REWRITE
              UPDATE 
              USING (default::currentUser);
      };
  };
};
