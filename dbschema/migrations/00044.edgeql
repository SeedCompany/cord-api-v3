CREATE MIGRATION m1zpp5l5wqgcm7hmcunnzswx6oivv7eh5gtwq5ysfaxlk5vhkfjieq
    ONTO m1wmrb3grzq5y55y5c447noyxdw26fcpatlu46n5f6ffh572opam6a
{
  ALTER TYPE default::Post {
      ALTER LINK container {
          SET TYPE Mixin::Postable USING (.container[IS Mixin::Postable]);
      };
      DROP TRIGGER enforcePostable;
  };
};
