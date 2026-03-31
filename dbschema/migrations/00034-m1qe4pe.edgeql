CREATE MIGRATION m1qe4pe3jm66gavbvflww62fdofpp4x7srbpgoeqyo6ojtqydlwxba
    ONTO m16y5z7zw6smsjr4ikg7i67jsvjlo3qibzblmvnb43smvrnxt57xwa
{
  ALTER TYPE default::FieldRegion {
      CREATE LINK projects := (.<fieldRegion[IS default::Project]);
  };
  ALTER TYPE default::FieldZone {
      CREATE LINK projects := (.<fieldZone[IS default::FieldRegion].projects);
  };
};
