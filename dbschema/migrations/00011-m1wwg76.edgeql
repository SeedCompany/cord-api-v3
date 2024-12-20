CREATE MIGRATION m1wwg76ehuufntgxnrnfhvejnb5zvc33raag4o62zud3uhoyq44rbq
    ONTO m1zbd7jjxvlolupx2hntj4qjunhqxyyd2ryjzwjczp67il32vtbmfa
{
  ALTER TYPE default::LanguageEngagement {
      CREATE PROPERTY usingAIAssistedTranslation: std::bool;
  };
};
