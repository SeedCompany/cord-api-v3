CREATE MIGRATION m1cjlglhqrzb4xhjb2u5xucr5rqnxaljhlyk7vsofswlkdj3nvclrq
    ONTO m1lyywc5pcxyfanxv2acytadtefwklgvbscl4dpm5fnfsjivxvixea
{
  ALTER TYPE default::FieldRegion {
      CREATE MULTI LINK projects := (.<fieldRegion[IS default::Project]);
  };
  ALTER TYPE default::FieldZone {
      CREATE MULTI LINK projects := (.<fieldZone[IS default::FieldRegion].projects);
  };
};
