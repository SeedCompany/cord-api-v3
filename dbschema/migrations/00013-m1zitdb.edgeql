CREATE MIGRATION m1pytxnqwlhqituog3zrfnocc7khycj3b6rcf6rkm6ek3cnhh4esqa
    ONTO m1ec555emidxpj7eojvqzlxo6b4aynlblocm5mqv7xoptagjodyffq
{
  ALTER TYPE default::LanguageEngagement {
      ALTER PROPERTY milestoneReached {
          SET REQUIRED USING (<Language::Milestone>'Unknown');
      };
  };
  CREATE SCALAR TYPE Engagement::AIAssistedTranslation EXTENDING enum<Unknown, None, Draft, `Check`, DraftAndCheck, Other>;
  ALTER TYPE default::LanguageEngagement {
      ALTER PROPERTY usingAIAssistedTranslation {
          SET default := (Engagement::AIAssistedTranslation.Unknown);
          SET TYPE Engagement::AIAssistedTranslation USING (<Engagement::AIAssistedTranslation>'Unknown');
          SET REQUIRED USING (<Engagement::AIAssistedTranslation>'Unknown');
      };
  };
};
