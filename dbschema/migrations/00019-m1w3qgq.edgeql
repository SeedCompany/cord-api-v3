CREATE MIGRATION m15ft6mwgrrg32svmobb2cqhjsq3uq6jukq7cnayv3umyu2kgk3nra
    ONTO m1hn3c7dprlsrrefs56alty2y4q475cofaqt3qd5okdmo3cj5uly4a
{
  ALTER TYPE default::Language {
    CREATE REQUIRED PROPERTY isAvailableForReporting: std::bool {
      SET default := false;
    };
    CREATE REQUIRED PROPERTY isWiderComm: std::bool {
      SET default := false;
    };
  };
  ALTER TYPE default::Partner {
    CREATE LINK languageOfReporting: default::Language;
  };
};
