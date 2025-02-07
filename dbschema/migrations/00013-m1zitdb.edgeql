CREATE MIGRATION m1zitdbhkuio47b5dgcro6do27hn7jjlc2iosjmt4ayzkmwp4wqu2q
    ONTO m1ec555emidxpj7eojvqzlxo6b4aynlblocm5mqv7xoptagjodyffq
{
  ALTER TYPE default::LanguageEngagement {
      ALTER PROPERTY milestoneReached {
          SET REQUIRED USING (<Language::Milestone>'Unknown');
      };
  };
  CREATE SCALAR TYPE Engagement::AIAssistedTranslation EXTENDING enum<Unknown, None, Drafting, Checking, Other>;
  ALTER TYPE default::LanguageEngagement {
      ALTER PROPERTY usingAIAssistedTranslation {
          SET default := (Engagement::AIAssistedTranslation.Unknown);
          SET TYPE Engagement::AIAssistedTranslation USING (<Engagement::AIAssistedTranslation>'Unknown');
          SET REQUIRED USING (<Engagement::AIAssistedTranslation>'Unknown');
      };
  };
};
