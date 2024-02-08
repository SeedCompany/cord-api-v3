CREATE MIGRATION m1mbjrsuqwwklgbswbvdbryp4p7gpgevkd7eq2qx6hfelhjvipkyhq
    ONTO m1vp4elagp7wzixttjl3s6pk2q5ml2p4zq35vvdc3nouewe3qvcm3q
{
  CREATE FUNCTION default::date_range_get_upper(period: range<cal::local_date>) ->  cal::local_date USING (WITH
      e := 
          std::assert_exists(std::range_get_upper(period))
  SELECT
      cal::to_local_date(<std::int64>cal::date_get(e, 'year'), <std::int64>cal::date_get(e, 'month'), (<std::int64>cal::date_get(e, 'day') - 1))
  );
  CREATE ABSTRACT TYPE default::PeriodicReport EXTENDING default::Resource, Mixin::Embedded {
      CREATE REQUIRED PROPERTY period: range<cal::local_date>;
      CREATE PROPERTY `end` := (default::date_range_get_upper(.period));
      CREATE LINK reportFile: default::File;
      CREATE PROPERTY receivedDate: cal::local_date;
      CREATE PROPERTY skippedReason: std::str;
      CREATE PROPERTY `start` := (std::range_get_lower(.period));
  };
  CREATE TYPE default::FinancialReport EXTENDING default::PeriodicReport, Project::Child {
      ALTER LINK container {
          SET OWNED;
          SET TYPE default::Project USING (<default::Project>{});
      };
  };
  CREATE TYPE default::NarrativeReport EXTENDING default::PeriodicReport, Project::Child {
      ALTER LINK container {
          SET OWNED;
          SET TYPE default::Project USING (<default::Project>{});
      };
  };
  CREATE TYPE default::ProgressReport EXTENDING default::PeriodicReport, Engagement::Child {
      ALTER LINK container {
          SET OWNED;
          SET TYPE default::LanguageEngagement USING (<default::LanguageEngagement>{});
      };
      ALTER LINK engagement {
          SET OWNED;
          SET TYPE default::LanguageEngagement USING (<default::LanguageEngagement>{});
      };
  };
};
