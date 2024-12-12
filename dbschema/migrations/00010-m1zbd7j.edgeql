CREATE MIGRATION m1zbd7jjxvlolupx2hntj4qjunhqxyyd2ryjzwjczp67il32vtbmfa
    ONTO m17teecxqpduefkkjxf64pokydi5e2ztcip6ayk23fvm6snddjbksa
{
  CREATE MODULE Language IF NOT EXISTS;
  CREATE SCALAR TYPE Language::Milestone EXTENDING enum<Unknown, None, OldTestament, NewTestament, FullBible>;
  ALTER TYPE default::LanguageEngagement {
      CREATE PROPERTY milestoneReached: Language::Milestone {
          SET default := (Language::Milestone.Unknown);
      };
  };
};
