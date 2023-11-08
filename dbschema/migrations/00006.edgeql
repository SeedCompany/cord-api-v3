CREATE MIGRATION m1hjnudahjdbrqvoi7ikqsalk5uv4gyfk5rbzcnonq2qoauw4ee2ea
    ONTO m1mhq7b2c53yr7fxf7x5sgjogvrkg4hjj2nhpdivxja66sjpc5amza
{
  ALTER TYPE default::InternshipEngagement {
      ALTER LINK project {
          RESET OPTIONALITY;
          RESET TYPE;
      };
  };
  ALTER TYPE default::LanguageEngagement {
      ALTER LINK project {
          RESET OPTIONALITY;
          RESET TYPE;
      };
  };
};
