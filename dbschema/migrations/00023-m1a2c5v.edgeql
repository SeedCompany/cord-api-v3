CREATE MIGRATION m1b5s7hceyvocniyc36jescvupoc3tmtuzftw4nuhpzzgdnac3r62a
    ONTO m1fxga4bkizfi427as2vhb33qnoe3tmkgrgsjduut7nksdhcv5llqa
{
  CREATE SCALAR TYPE default::Gender EXTENDING enum<Male, Female>;
  ALTER TYPE default::User {
      CREATE LINK photo: default::File;
      CREATE PROPERTY gender: default::Gender;
  };
};
