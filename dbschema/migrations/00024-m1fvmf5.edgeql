CREATE MIGRATION m1whnqsnrcplwvgjlz57qcvkzld25fhydvj4xhihmfu6byois4ahda
    ONTO m1b5s7hceyvocniyc36jescvupoc3tmtuzftw4nuhpzzgdnac3r62a
{
  ALTER TYPE default::LanguageEngagement {
      ALTER PROPERTY milestoneReached RENAME TO milestonePlanned;
      CREATE PROPERTY milestoneReached: std::bool;
  };
};
