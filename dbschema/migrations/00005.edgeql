CREATE MIGRATION m1mhq7b2c53yr7fxf7x5sgjogvrkg4hjj2nhpdivxja66sjpc5amza
    ONTO m1unudoy7u4j3s2waa5jadkb43qedra7r6eab3ndzk22fhf4p5bfwq
{
  CREATE FUNCTION default::str_sortable(value: std::str) ->  std::str USING (std::str_lower(std::re_replace('Ñ', 'N', std::str_trim(std::re_replace(r'[ [\]|,\-$]+', ' ', value, flags := 'g')), flags := 'g')));
  ALTER TYPE default::Language {
      CREATE INDEX ON (default::str_sortable(.name));
      CREATE INDEX ON (.sensitivity);
      CREATE INDEX ON ((.name, .sensitivity, .leastOfThese, .isSignLanguage, .isDialect));
      ALTER TRIGGER recalculateProjectSens USING (UPDATE
          (SELECT
              default::TranslationProject
          FILTER
              ((__new__ IN .languages) AND (.sensitivity != (std::max(.languages.sensitivity) ?? default::Sensitivity.High)))
          )
      SET {
          sensitivity := (std::max(.languages.sensitivity) ?? default::Sensitivity.High)
      });
  };
  ALTER TYPE default::LanguageEngagement {
      ALTER TRIGGER recalculateProjectSensOnDelete USING (WITH
          removedLang := 
              __old__.language
      UPDATE
          (SELECT
              default::TranslationProject
          FILTER
              ((__old__ IN .languages) AND (.sensitivity != (std::max(((.languages EXCEPT removedLang)).sensitivity) ?? default::Sensitivity.High)))
          )
      SET {
          sensitivity := (std::max(((.languages EXCEPT removedLang)).sensitivity) ?? default::Sensitivity.High)
      });
      ALTER TRIGGER recalculateProjectSensOnInsert USING (UPDATE
          (SELECT
              default::TranslationProject
          FILTER
              ((__new__ IN .languages) AND (.sensitivity != (std::max(.languages.sensitivity) ?? default::Sensitivity.High)))
          )
      SET {
          sensitivity := (std::max(.languages.sensitivity) ?? default::Sensitivity.High)
      });
  };
};
