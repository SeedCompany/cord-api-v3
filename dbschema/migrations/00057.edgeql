CREATE MIGRATION m157gy3t5mh6e3rdvucz3kyjnyvqcztjujwg6tidwsgiopximyrcja
    ONTO m1fxvebe36c36flhjxywklrqqquert6b7dj5j4biwl6gxaqpddz5ra
{
  CREATE SCALAR TYPE default::nanoid EXTENDING std::str;
  ALTER TYPE Prompt::PromptVariantResponse {
      ALTER PROPERTY promptId {
          SET TYPE default::nanoid;
      };
  };
};
