CREATE MIGRATION m13kr5hbnbuidyg3qtxulx7k53yqzb3sxcvacxryesnkgut3ntxtla
    ONTO m1mbjrsuqwwklgbswbvdbryp4p7gpgevkd7eq2qx6hfelhjvipkyhq
{
  CREATE MODULE ProgressReport IF NOT EXISTS;
  CREATE ABSTRACT TYPE ProgressReport::Child EXTENDING Engagement::Child {
      CREATE ANNOTATION std::description := 'A type that is a child of a progress report. It will always have a reference to a single progress report and engagement that it is under.';
      CREATE REQUIRED LINK report: default::ProgressReport {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE TRIGGER enforceProgressReportEngagement
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((__new__.report.engagement = __new__.engagement), message := 'Given progress report must be for the same engagement as the given engagement'));
  };
  CREATE TYPE ProgressReport::VarianceExplanation EXTENDING ProgressReport::Child {
      ALTER LINK report {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY comments: default::RichText;
      CREATE MULTI PROPERTY reasons: std::str;
  };
  ALTER TYPE default::ProgressReport {
      CREATE SINGLE LINK varianceExplanation := (.<report[IS ProgressReport::VarianceExplanation]);
  };
};
