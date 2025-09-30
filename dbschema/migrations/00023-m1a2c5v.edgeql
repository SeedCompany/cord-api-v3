CREATE MIGRATION m1a2c5vqdusxdhh4chutow42naqlsap7yrbifbvrwnwe4flfwosmqa
    ONTO m1fxga4bkizfi427as2vhb33qnoe3tmkgrgsjduut7nksdhcv5llqa
{
  CREATE SCALAR TYPE User::Gender EXTENDING enum<Male, Female>;
  ALTER TYPE default::User {
      CREATE LINK photo: default::File;
      CREATE PROPERTY gender: User::Gender;
  };
};
