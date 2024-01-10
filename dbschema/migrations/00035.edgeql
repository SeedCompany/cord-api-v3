CREATE MIGRATION m13bndkbclxwviy3uj4eskx56bd2chw2xbvfn5pae557oslmbz2ssa
    ONTO m1abuwgh5eb3m3ivtyo6lru3w6k7ermhoof3bphd72jtx2cezj7ewa
{
  ALTER TYPE default::Project {
      ALTER PROPERTY departmentId {
          CREATE CONSTRAINT std::exclusive;
          CREATE CONSTRAINT std::max_value(99999);
          CREATE CONSTRAINT std::min_value(10000);
      };
  };
};
