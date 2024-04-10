CREATE MIGRATION m165jniqsw3z3zqp7yfhfo6x7tjiaalkxsjnk2cphundlg6ct37vvq
    ONTO m1sfauxznuxghwg6pwtxfo5fk6azud5xl6m4fhqqboriroejwpeegq
{
  ALTER TYPE default::TranslationProject SET ABSTRACT;
  CREATE TYPE default::MomentumTranslationProject EXTENDING default::TranslationProject;
  CREATE TYPE default::MultiplicationTranslationProject EXTENDING default::TranslationProject;
};
