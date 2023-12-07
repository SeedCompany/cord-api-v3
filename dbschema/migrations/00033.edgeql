CREATE MIGRATION m1cwdkj3hjcsprjurukh7aaofw63m5avm52nkzekwwdmliytgx4wja
    ONTO m1hb7zty3d4ekb5ftznc4tv4h5mgkxy6db42zbxylaw2rmrpveqsxq
{
  ALTER TYPE default::Language {
      CREATE REQUIRED PROPERTY isLanguageOfConsulting: std::bool {
          SET default := false;
      };
  };
};
