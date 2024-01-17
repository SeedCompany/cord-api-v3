CREATE MIGRATION m1r3t2ku2jysgjliaq54y7saj4tuxecilnajoxgwa2blsb3p64svzq
    ONTO m1xhtylawlv6ksvlfkuw6bien5fobo6mtlj3xgr33uya6hnhcnmn7a
{
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY chapter {
          CREATE CONSTRAINT std::expression ON (((__subject__ >= 1) AND (__subject__ <= 150)));
      };
  };
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY chapter {
          DROP CONSTRAINT std::max_value(150);
      };
  };
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY chapter {
          DROP CONSTRAINT std::min_value(1);
      };
  };
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY verse {
          CREATE CONSTRAINT std::expression ON (((__subject__ >= 1) AND (__subject__ <= 176)));
      };
  };
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY verse {
          DROP CONSTRAINT std::max_value(176);
      };
  };
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY verse {
          DROP CONSTRAINT std::min_value(1);
      };
  };
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY verseId {
          CREATE CONSTRAINT std::expression ON (((__subject__ >= 0) AND (__subject__ <= 31101)));
      };
  };
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY verseId {
          DROP CONSTRAINT std::max_value(31101);
      };
  };
  ALTER TYPE Scripture::Verse {
      ALTER PROPERTY verseId {
          DROP CONSTRAINT std::min_value(0);
      };
  };
  ALTER TYPE default::FundingAccount {
      ALTER PROPERTY accountNumber {
          CREATE CONSTRAINT std::expression ON (((__subject__ >= 0) AND (__subject__ <= 9)));
      };
  };
  ALTER TYPE default::FundingAccount {
      ALTER PROPERTY accountNumber {
          DROP CONSTRAINT std::max_value(9);
      };
  };
  ALTER TYPE default::FundingAccount {
      ALTER PROPERTY accountNumber {
          DROP CONSTRAINT std::min_value(0);
      };
  };
  ALTER TYPE default::Project {
      ALTER PROPERTY departmentId {
          CREATE CONSTRAINT std::expression ON (((__subject__ >= 10000) AND (__subject__ <= 99999)));
      };
  };
  ALTER TYPE default::Project {
      ALTER PROPERTY departmentId {
          DROP CONSTRAINT std::max_value(99999);
      };
  };
  ALTER TYPE default::Project {
      ALTER PROPERTY departmentId {
          DROP CONSTRAINT std::min_value(10000);
      };
  };
  ALTER SCALAR TYPE default::population {
      CREATE CONSTRAINT std::expression ON ((__subject__ >= 0));
  };
  ALTER SCALAR TYPE default::population {
      DROP CONSTRAINT std::min_value(0);
  };
};
