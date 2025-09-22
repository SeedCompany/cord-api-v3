CREATE MIGRATION m1vlvhhn4bbuxj4ntl2zkrsjal3rhytpr5wqnxkfpaj7gyffawlfrq
    ONTO m1lvqi2cqin5vxdmg6o7ru557hntzlcdancr62oks5b6w72ftk5cqq
{
  CREATE TYPE Finance::Department::ExternalId EXTENDING Mixin::Named {
      CREATE ANNOTATION std::description := 'A department ID used outside of this system.';
      CREATE REQUIRED PROPERTY departmentId: std::str {
          CREATE CONSTRAINT std::exclusive;
          CREATE CONSTRAINT std::expression ON (((<std::int32>__subject__ > 0) AND (std::len(__subject__) = 5)));
      };
  };
  ALTER TYPE Finance::Department::IdBlock {
      ALTER PROPERTY nextAvailable {
          USING (std::min((SELECT
              ((Finance::Department::enumerateIds(.range) EXCEPT default::Project.departmentId) EXCEPT Finance::Department::ExternalId.departmentId)
          )));
      };
  };
};
