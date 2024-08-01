CREATE MIGRATION m1ah2npzra5pek4sq777ow5uvmwuxeediqm5kp2x2zek2zlyjdwg5q
    ONTO m17u4aufxga7wgmcebhiaapulc7xrqg34hcbmucddbvm4tw5c63kyq
{
  ALTER TYPE default::Language {
      ALTER PROPERTY registryOfDialectsCode {
          RENAME TO registryOfLanguageVarietiesCode;
      };
  };
};
