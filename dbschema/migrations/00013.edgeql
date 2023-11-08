CREATE MIGRATION m1v3l6r54gp2kccouwc6nv7jpogxfsfyclk5l7yqds4pj4qyunyqra
    ONTO m1moj5gskfzn7ieyayntlanzckxil5nhwjxmnp6zjfuhb64rcfzscq
{
  ALTER TYPE default::Language {
      DROP TRIGGER connectEthnologue;
      DROP TRIGGER recalculateProjectSens;
  };
  ALTER TYPE default::LanguageEngagement {
      DROP TRIGGER recalculateProjectSensOnDelete;
      DROP TRIGGER recalculateProjectSensOnInsert;
  };
  ALTER TYPE default::TranslationProject {
      DROP TRIGGER confirmProjectSens;
  };
};
