CREATE MIGRATION m1uod3hyqn64tbkbnyve7ec7ny6l67wuueaoa4juxqol4gjbtq4euq
    ONTO m1td3tupj5cvi3sns4666u5jtgug2t22vwo6dbgykirlvp6m345xha
{
  CREATE SCALAR TYPE ProgressReport::ProductProgress::Period EXTENDING enum<ReportPeriod, FiscalYearSoFar, Cumulative>;
  CREATE TYPE ProgressReport::ProductProgress::Summary {
      CREATE REQUIRED LINK report: default::ProgressReport;
      CREATE REQUIRED PROPERTY period: ProgressReport::ProductProgress::Period;
      CREATE CONSTRAINT std::exclusive ON ((.report, .period));
      CREATE REQUIRED PROPERTY actual: std::float32;
      CREATE REQUIRED PROPERTY planned: std::float32;
  };
  ALTER TYPE default::DerivativeScriptureProduct {
      ALTER PROPERTY totalVerseEquivalents {
          SET TYPE std::float32 USING (<std::float32>.totalVerseEquivalents);
      };
  };
  ALTER TYPE default::DirectScriptureProduct {
      ALTER PROPERTY totalVerseEquivalents {
          SET TYPE std::float32 USING (<std::float32>.totalVerseEquivalents);
      };
  };
};
