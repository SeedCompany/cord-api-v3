CREATE MIGRATION m1pv2ojzfsv7yjfeac7r4pb23nogec235dasqgmosh2utwzome3bcq
    ONTO m17u4aufxga7wgmcebhiaapulc7xrqg34hcbmucddbvm4tw5c63kyq
{
  ALTER TYPE default::Partner {
      ALTER PROPERTY globalInnovationsClient {
          RENAME TO growthPartnersClient;
      };
  };
};
