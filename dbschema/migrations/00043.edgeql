CREATE MIGRATION m1wmrb3grzq5y55y5c447noyxdw26fcpatlu46n5f6ffh572opam6a
    ONTO m1r3t2ku2jysgjliaq54y7saj4tuxecilnajoxgwa2blsb3p64svzq
{
  CREATE SCALAR TYPE default::RichText EXTENDING std::json;
  ALTER TYPE default::Engagement {
      ALTER PROPERTY description {
          SET TYPE default::RichText;
      };
  };
  ALTER TYPE default::Post {
      ALTER PROPERTY body {
          SET TYPE default::RichText;
      };
  };
};
