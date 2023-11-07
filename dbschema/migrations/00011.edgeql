CREATE MIGRATION m1je52dmicyhild43tygqtxydgf4mp5nymhqyibrzv2a2yg5kbf4yq
    ONTO m1bl5usbsd57f2obaikame74dp7p3oitsmulfitpvducp2k4oetwea
{
  ALTER TYPE Ethnologue::Language {
      CREATE REQUIRED LINK language: default::Language {
          ON TARGET DELETE DELETE SOURCE;
          SET REQUIRED USING (SELECT
              default::Language FILTER
                  (.ethnologue = __source__)
          LIMIT
              1
          );
          CREATE CONSTRAINT std::exclusive;
      };
  };
  ALTER TYPE default::Language {
      ALTER LINK ethnologue {
          RESET default;
          USING (std::assert_exists(std::assert_single(.<language[IS Ethnologue::Language])));
          RESET ON SOURCE DELETE;
          SET SINGLE;
      };
      CREATE TRIGGER connectEthnologue
          AFTER INSERT 
          FOR EACH DO (INSERT
              Ethnologue::Language
              {
                  language := __new__
              });
  };
};
