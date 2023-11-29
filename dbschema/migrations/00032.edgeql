CREATE MIGRATION m1hb7zty3d4ekb5ftznc4tv4h5mgkxy6db42zbxylaw2rmrpveqsxq
    ONTO m1wzaeho6j66fhwcmgkeezkp52hqwxgc27uy7yqsdgml3qekc2iarq
{
  CREATE SCALAR TYPE User::Degree EXTENDING enum<Primary, Secondary, Associates, Bachelors, Masters, Doctorate>;
  CREATE TYPE User::Education EXTENDING default::Resource {
      CREATE REQUIRED PROPERTY degree: User::Degree;
      CREATE REQUIRED PROPERTY institution: std::str;
      CREATE REQUIRED PROPERTY major: std::str;
  };
  ALTER TYPE default::User {
      CREATE MULTI LINK education: User::Education {
          ON TARGET DELETE ALLOW;
      };
  };
  CREATE TYPE User::Unavailability EXTENDING default::Resource {
      CREATE REQUIRED PROPERTY dates: range<cal::local_date>;
      CREATE REQUIRED PROPERTY description: std::str;
  };
  ALTER TYPE default::User {
      CREATE MULTI LINK unavailabilities: User::Unavailability {
          ON TARGET DELETE ALLOW;
      };
  };
};
