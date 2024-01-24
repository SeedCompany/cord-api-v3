CREATE MIGRATION m1asch4l54f7eltalgtn3ft3kbtgzascsjujcjnonx6yloej5ujkpa
    ONTO m1zqlgbrht5kontkpocymsg2f7wit5rsxkmgy6uy56myfyhncrvlvq
{
  ALTER TYPE default::Language {
      ALTER TRIGGER connectEthnologue USING (((SELECT
          Ethnologue::Language
      FILTER
          (.language = __new__)
      ) ?? (INSERT
          Ethnologue::Language
          {
              language := __new__,
              ownSensitivity := __new__.ownSensitivity,
              projectContext := __new__.projectContext
          })));
  };
};
