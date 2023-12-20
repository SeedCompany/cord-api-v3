CREATE MIGRATION m1moj5gskfzn7ieyayntlanzckxil5nhwjxmnp6zjfuhb64rcfzscq
    ONTO m1je52dmicyhild43tygqtxydgf4mp5nymhqyibrzv2a2yg5kbf4yq
{
  ALTER TYPE Ethnologue::Language EXTENDING Project::HasContext LAST;
  ALTER TYPE default::Language {
      DROP PROPERTY isMember;
  };
  ALTER TYPE default::Language {
      DROP LINK projects;
      EXTENDING Project::HasContext LAST;
  };
  ALTER TYPE default::Language {
      ALTER TRIGGER connectEthnologue USING (INSERT
          Ethnologue::Language
          {
              language := __new__,
              projectContext := __new__.projectContext
          });
      ALTER PROPERTY ownSensitivity {
          RESET OPTIONALITY;
          RESET TYPE;
      };
  };
  ALTER TYPE default::Language {
      CREATE TRIGGER matchEthnologueToOwnSens
          AFTER UPDATE, INSERT 
          FOR EACH DO (UPDATE
              __new__.ethnologue
          FILTER
              (.ownSensitivity != __new__.ownSensitivity)
          SET {
              ownSensitivity := __new__.ownSensitivity
          });
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE TRIGGER addProjectToContextOfLanguage
          AFTER INSERT 
          FOR EACH DO (UPDATE
              __new__.language.projectContext
          SET {
              projects += __new__.project
          });
      CREATE TRIGGER removeProjectFromContextOfLanguage
          AFTER DELETE 
          FOR EACH DO (UPDATE
              __old__.language.projectContext
          SET {
              projects -= __old__.project
          });
  };
};
