CREATE MIGRATION m1td3tupj5cvi3sns4666u5jtgug2t22vwo6dbgykirlvp6m345xha
    ONTO m1shta7vgmvlfcofj5wxkhkzx7lzarwzs6mzd63kenlksmrfgsemaa
{
  CREATE MODULE ProgressReport::ProductProgress IF NOT EXISTS;
  CREATE SCALAR TYPE ProgressReport::ProductProgress::Variant EXTENDING enum<Official, Partner>;
  CREATE TYPE ProgressReport::ProductProgress::Step EXTENDING Mixin::Timestamped {
      CREATE REQUIRED LINK product: default::Product;
      CREATE REQUIRED LINK report: default::ProgressReport;
      CREATE REQUIRED PROPERTY step: Product::Step;
      CREATE REQUIRED PROPERTY variant: ProgressReport::ProductProgress::Variant;
      CREATE CONSTRAINT std::exclusive ON ((.report, .product, .variant, .step));
      CREATE PROPERTY completed: std::float32;
  };
};
