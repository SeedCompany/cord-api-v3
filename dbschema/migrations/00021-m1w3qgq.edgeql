CREATE MIGRATION m1w3qgqsme36dslef5c435oz4gfqut6uujb67s66k5nsmkxun6vjia
    ONTO m17rl5lo5wwq63duwmpqjtdqfuhq3luocyigofuobamdcu6l4dlepq
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
