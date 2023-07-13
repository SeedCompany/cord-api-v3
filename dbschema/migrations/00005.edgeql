CREATE MIGRATION m1yebbpptyoc3rgyssotxy62c7tcnquzkt7tbpa6j4cs2xbjyojsca
    ONTO m1zvgtl6fsi4h7kuyygotlso3rrvgaidyqep6glwsibn5njizku6yq
{
  ALTER TYPE default::Language {
      CREATE MULTI LINK projects := (.engagements.project);
  };
};
