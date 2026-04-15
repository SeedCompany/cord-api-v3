CREATE MIGRATION m1eossglz2cv4x6zc656qq5xft3axauywf4t7znhyklv4mrbfngsiq
    ONTO m1qe4pe3jm66gavbvflww62fdofpp4x7srbpgoeqyo6ojtqydlwxba
{
  ALTER TYPE default::Tool {
      CREATE OPTIONAL PROPERTY description: std::str;
  };
};
