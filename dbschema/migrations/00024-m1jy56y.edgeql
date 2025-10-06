CREATE MIGRATION m1jy56y4xhxcsfl2qeznyfwror635bx5hukemmsuqxavmmiyxf7hta
    ONTO m1b5s7hceyvocniyc36jescvupoc3tmtuzftw4nuhpzzgdnac3r62a
{
  ALTER TYPE default::LanguageEngagement {
      CREATE REQUIRED PROPERTY completedMilestone: std::bool {
          SET default := false;
      };
  };
};
