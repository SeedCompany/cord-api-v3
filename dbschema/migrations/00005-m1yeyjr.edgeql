CREATE MIGRATION m1yeyjrzkznhb2fr4txj432k3nlumdnjwsdyuhinrfmt64je5lwfta
    ONTO m1yphrx7buk7mltbmsuabovma34ukfn7dkllc3pfggljlkadasw2gq
{
  ALTER TYPE default::Engagement {
      ALTER PROPERTY completedDate {
          RENAME TO completeDate;
      };
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE TRIGGER denyDuplicateFirstScriptureBasedOnExternal
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((NOT (__new__.firstScripture) OR NOT (EXISTS (__new__.language.hasExternalFirstScripture))), message := 'First scripture has already been marked as having been done externally'));
      CREATE TRIGGER denyDuplicateFirstScriptureBasedOnOtherEngagement
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert(NOT (EXISTS ((SELECT
              __new__.language.engagements
          FILTER
              .firstScripture
          ))), message := 'Another engagement has already been marked as having done the first scripture'));
  };
};
