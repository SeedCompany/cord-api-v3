CREATE MIGRATION m1bh4xyugmqj3aeh2pujkbly6uq7lxdisxwdodawgw2flyvbxfnkkq
    ONTO m1vzgo7d3slqdwhpmcigvmaxnh3cz7nhympvu7mb5g3beipzfve5tq
{
  ALTER TYPE default::Post {
      DROP PROPERTY sensitivity;
  };
  ALTER TYPE Project::ContextAware {
      DROP PROPERTY sensitivity;
  };
  ALTER TYPE default::InternshipEngagement {
      ALTER LINK project {
          SET REQUIRED;
          SET TYPE default::InternshipProject USING (.project[IS default::InternshipProject]);
      };
  };
  ALTER TYPE default::Project {
      ALTER PROPERTY ownSensitivity {
          SET REQUIRED USING (default::Sensitivity.High);
          SET TYPE default::Sensitivity;
      };
  };
  ALTER TYPE default::Language {
      ALTER PROPERTY ownSensitivity {
          SET REQUIRED USING (default::Sensitivity.High);
          SET TYPE default::Sensitivity;
      };
  };
  ALTER TYPE default::LanguageEngagement {
      ALTER LINK project {
          SET REQUIRED;
          SET TYPE default::TranslationProject USING (.project[IS default::TranslationProject]);
      };
  };
};
