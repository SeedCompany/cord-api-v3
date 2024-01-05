CREATE MIGRATION m1abuwgh5eb3m3ivtyo6lru3w6k7ermhoof3bphd72jtx2cezj7ewa
    ONTO m1ijgeabkfengfe2lpxjtq7xxqjiulhehay7tuutdoa5g3scsenwvq
{
  ALTER TYPE default::Project {
      CREATE LINK fieldRegion: default::FieldRegion;
      CREATE LINK marketingLocation: default::Location;
      CREATE LINK primaryLocation: default::Location;
      CREATE TRIGGER enforceFundingAccount
          AFTER UPDATE 
          FOR EACH DO (std::assert((std::any((__new__.primaryLocation.fundingAccount.accountNumber > 0)) OR NOT (EXISTS (__new__.primaryLocation))), message := 'Project must have a primary location with a specified funding account'));
      ALTER PROPERTY departmentId {
          SET TYPE std::int32 USING (<std::int32>.departmentId);
      };
  };
};
