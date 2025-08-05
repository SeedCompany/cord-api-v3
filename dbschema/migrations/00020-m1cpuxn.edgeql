CREATE MIGRATION m1cpuxnjoiyehcwsjdlul7vt4s4audncdb3immaclqupzrr27ud44a
    ONTO m1lyywc5pcxyfanxv2acytadtefwklgvbscl4dpm5fnfsjivxvixea
{
  ALTER TYPE default::Language {
      CREATE PROPERTY usesAIAssistance := (EXISTS ((SELECT
          .engagements
      FILTER
          (.usingAIAssistedTranslation NOT IN {Engagement::AIAssistedTranslation.None, Engagement::AIAssistedTranslation.Unknown})
      )));
  };
};
