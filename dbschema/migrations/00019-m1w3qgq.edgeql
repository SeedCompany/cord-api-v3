CREATE MIGRATION m1lyywc5pcxyfanxv2acytadtefwklgvbscl4dpm5fnfsjivxvixea
    ONTO m1hn3c7dprlsrrefs56alty2y4q475cofaqt3qd5okdmo3cj5uly4a
{
  ALTER TYPE default::Language {
    CREATE REQUIRED PROPERTY isAvailableForReporting: std::bool {
      SET default := false;
    };
  };
  ALTER TYPE default::Partner {
    CREATE LINK languageOfReporting: default::Language;
  };
};
