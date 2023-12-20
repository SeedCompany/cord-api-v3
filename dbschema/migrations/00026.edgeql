CREATE MIGRATION m1ok72bpxjse45mrwdfp2hslsft4pbqqg375z3tqzntv4nqiahsoxq
    ONTO m1b277rn3kn27wwnljx5nr3sgzyaxnx2mfzwq6audnkcifswhyq5ja
{
  ALTER TYPE default::Language {
      ALTER LINK engagements {
          RESET CARDINALITY;
      };
      CREATE LINK projects := (SELECT
          default::TranslationProject
      FILTER
          (__source__ = .languages)
      );
  };
};
