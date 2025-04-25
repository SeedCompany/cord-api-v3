CREATE MIGRATION m1rvjzyc3wqghcnz3y26pchj3lrv4doeuwtmt25pyryutahan4s3eq
    ONTO m1d2nmzhgsu7jc75xtbjt4zdvroszkfcbtmdrap2kohcto4fbpqoia
{
  ALTER TYPE default::Language {
      CREATE REQUIRED PROPERTY isLanguageOfReporting: std::bool {
          SET default := false;
      };
      CREATE REQUIRED PROPERTY isLanguageOfWiderCommunication: std::bool {
          SET default := false;
      };
  };
  ALTER TYPE default::Partner {
      CREATE LINK languageOfReporting: default::Language;
  };
};
