CREATE MIGRATION m1w6sepotsepo4bbhstbvk7k3zajdjbjinhmmixuudgp3elcf66fiq
    ONTO m1my4gnalxbdroxdfajzul5nmhg3jhwnmogtt2wxv2hrzv2p7tj2xa
{
  ALTER TYPE default::Language {
      ALTER TRIGGER recalculateProjectSens USING (UPDATE
          (SELECT
              __new__.projects
          FILTER
              (.ownSensitivity != (std::max(.languages.ownSensitivity) ?? default::Sensitivity.High))
          )
      SET {
          ownSensitivity := (std::max(.languages.ownSensitivity) ?? default::Sensitivity.High)
      });
  };
  ALTER TYPE default::LanguageEngagement {
      ALTER TRIGGER recalculateProjectSensOnDelete USING (WITH
          removedLang := 
              __old__.language
      UPDATE
          (SELECT
              __old__.project
          FILTER
              (.ownSensitivity != (std::max(((.languages EXCEPT removedLang)).ownSensitivity) ?? default::Sensitivity.High))
          )
      SET {
          ownSensitivity := (std::max(((.languages EXCEPT removedLang)).ownSensitivity) ?? default::Sensitivity.High)
      });
      ALTER TRIGGER recalculateProjectSensOnInsert USING (UPDATE
          (SELECT
              __new__.project
          FILTER
              (.ownSensitivity != (std::max(.languages.ownSensitivity) ?? default::Sensitivity.High))
          )
      SET {
          ownSensitivity := (std::max(.languages.ownSensitivity) ?? default::Sensitivity.High)
      });
  };
};
