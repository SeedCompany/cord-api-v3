CREATE MIGRATION m1dppmmlph6slcbs3kbiwtpegecjb5isy335ff4zlglui4zghlkmua
    ONTO m1f57erjzmisxbtd2xgj7zo33kgljsjaaohar22n5r27x7q6gzobea
{
  ALTER TYPE default::Language {
      ALTER TRIGGER connectEthnologue USING (INSERT
          Ethnologue::Language
          {
              language := __new__,
              ownSensitivity := __new__.ownSensitivity,
              projectContext := __new__.projectContext
          });
  };
  ALTER TYPE default::Language {
      DROP TRIGGER matchEthnologueToOwnSens;
  };
  ALTER TYPE default::Language {
      CREATE TRIGGER matchEthnologueToOwnSens
          AFTER UPDATE 
          FOR EACH DO (UPDATE
              __new__.ethnologue
          FILTER
              (.ownSensitivity != __new__.ownSensitivity)
          SET {
              ownSensitivity := __new__.ownSensitivity
          });
  };
};
