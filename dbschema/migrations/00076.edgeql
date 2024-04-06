CREATE MIGRATION m1uvexxh35nkdve7dqedttwvikcteavvm4qsknb73iag7v4zrodkwq
    ONTO m1w6sepotsepo4bbhstbvk7k3zajdjbjinhmmixuudgp3elcf66fiq
{
  ALTER TYPE default::Project {
      CREATE LINK marketingRegionOverride: default::FieldRegion;
      CREATE MULTI LINK otherLocations: default::Location;
  };
};
