CREATE MIGRATION m16y5z7zw6smsjr4ikg7i67jsvjlo3qibzblmvnb43smvrnxt57xwa
    ONTO m1n2nkh2n5chp4ztkt3khjuviv6v2dnujshzol3atfqwldfdirvyha
{
  ALTER TYPE default::Language {
      CREATE PROPERTY usesAIAssistance := (EXISTS ((SELECT
          .engagements
      FILTER
          (.usingAIAssistedTranslation NOT IN {Engagement::AIAssistedTranslation.None, Engagement::AIAssistedTranslation.Unknown})
      )));
  };
};
