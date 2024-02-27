CREATE MIGRATION m1fxvebe36c36flhjxywklrqqquert6b7dj5j4biwl6gxaqpddz5ra
    ONTO m13kr5hbnbuidyg3qtxulx7k53yqzb3sxcvacxryesnkgut3ntxtla
{
  CREATE MODULE Prompt IF NOT EXISTS;
  CREATE ABSTRACT TYPE Prompt::PromptVariantResponse EXTENDING Mixin::Embedded, Mixin::Timestamped, Mixin::Owned {
      CREATE ANNOTATION std::description := 'An instance of a prompt and the responses per variant.';
      CREATE PROPERTY promptId: std::str;
  };
  CREATE TYPE Prompt::VariantResponse EXTENDING Mixin::Timestamped, Mixin::Owned {
      CREATE REQUIRED LINK pvr: Prompt::PromptVariantResponse;
      CREATE REQUIRED PROPERTY variant: std::str;
      CREATE CONSTRAINT std::exclusive ON ((.pvr, .variant));
      CREATE ANNOTATION std::description := 'A response (for a variant) to an instance of a prompt.';
      CREATE PROPERTY response: default::RichText;
  };
  ALTER TYPE Prompt::PromptVariantResponse {
      CREATE LINK responses := (.<pvr[IS Prompt::VariantResponse]);
  };
};
