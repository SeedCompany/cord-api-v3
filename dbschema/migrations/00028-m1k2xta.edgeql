CREATE MIGRATION m1k2xtayazrywfs6y4bvw24x5id4xgsdjiu5uuk525becui22bcnya
    ONTO m13j2wdmzu2ee56a7cpvryzfqdoexqgfx2pbhqrdnrh5cjtkgybwhq
{
  ALTER TYPE default::Project {
      ALTER LINK marketingRegionOverride {
          SET TYPE default::Location USING (.marketingRegionOverride[IS default::Location]);
      };
  };
};
