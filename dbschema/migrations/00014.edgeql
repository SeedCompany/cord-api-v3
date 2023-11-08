CREATE MIGRATION m1f57erjzmisxbtd2xgj7zo33kgljsjaaohar22n5r27x7q6gzobea
    ONTO m1v3l6r54gp2kccouwc6nv7jpogxfsfyclk5l7yqds4pj4qyunyqra
{
  ALTER TYPE default::Language {
      CREATE TRIGGER connectEthnologue
          AFTER INSERT 
          FOR EACH DO (INSERT
              Ethnologue::Language
              {
                  language := __new__,
                  projectContext := __new__.projectContext
              });
      CREATE TRIGGER recalculateProjectSens
          AFTER UPDATE 
          FOR EACH DO (UPDATE
              (SELECT
                  default::TranslationProject
              FILTER
                  ((__new__ IN .languages) AND (.ownSensitivity != (std::max(.languages.ownSensitivity) ?? default::Sensitivity.High)))
              )
          SET {
              ownSensitivity := (std::max(.languages.ownSensitivity) ?? default::Sensitivity.High)
          });
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE TRIGGER recalculateProjectSensOnDelete
          AFTER DELETE 
          FOR EACH DO (WITH
              removedLang := 
                  __old__.language
          UPDATE
              (SELECT
                  default::TranslationProject
              FILTER
                  ((__old__ IN .languages) AND (.ownSensitivity != (std::max(((.languages EXCEPT removedLang)).ownSensitivity) ?? default::Sensitivity.High)))
              )
          SET {
              ownSensitivity := (std::max(((.languages EXCEPT removedLang)).ownSensitivity) ?? default::Sensitivity.High)
          });
      CREATE TRIGGER recalculateProjectSensOnInsert
          AFTER INSERT 
          FOR EACH DO (UPDATE
              (SELECT
                  default::TranslationProject
              FILTER
                  ((__new__ IN .languages) AND (.ownSensitivity != (std::max(.languages.ownSensitivity) ?? default::Sensitivity.High)))
              )
          SET {
              ownSensitivity := (std::max(.languages.ownSensitivity) ?? default::Sensitivity.High)
          });
  };
  ALTER TYPE default::TranslationProject {
      CREATE TRIGGER confirmProjectSens
          AFTER UPDATE 
          FOR EACH DO (std::assert((__new__.ownSensitivity = (std::max(__new__.languages.ownSensitivity) ?? default::Sensitivity.High)), message := 'TranslationProject sensitivity is automatically set to (and required to be) the highest sensitivity Language engaged'));
  };
};
