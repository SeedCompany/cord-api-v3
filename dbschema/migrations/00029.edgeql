CREATE MIGRATION m1t7atw76jdjhcnrngoj5euzbz7qxve7dokvbhh4x5333yxm5klkwa
    ONTO m1rob2znvgmu7myqon4wzkdxur6765udhhucohw6apoxhtrbbnxova
{
  CREATE MODULE Organization IF NOT EXISTS;
  CREATE MODULE Partner IF NOT EXISTS;
  CREATE SCALAR TYPE Organization::Reach EXTENDING enum<Local, Regional, National, `Global`>;
  CREATE SCALAR TYPE Organization::Type EXTENDING enum<Church, Parachurch, Mission, TranslationOrganization, Alliance>;
  CREATE TYPE default::Organization EXTENDING default::Resource, Project::ContextAware, Mixin::Named {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY acronym: std::str;
      CREATE MULTI PROPERTY reach: Organization::Reach;
      CREATE MULTI PROPERTY types: Organization::Type;
  };
  CREATE SCALAR TYPE Partner::FinancialReportingType EXTENDING enum<Funded, FieldEngaged, Hybrid>;
  CREATE SCALAR TYPE Partner::Type EXTENDING enum<Managing, Funding, Impact, Technical, Resource>;
  CREATE TYPE default::Partner EXTENDING default::Resource, Project::ContextAware, Mixin::Named, Mixin::Pinnable, Mixin::Taggable {
      CREATE REQUIRED LINK organization: default::Organization {
          SET readonly := true;
          CREATE CONSTRAINT std::exclusive;
      };
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE MULTI LINK countries: default::Location;
      CREATE MULTI LINK fieldRegions: default::FieldRegion;
      CREATE LINK languageOfWiderCommunication: default::Language;
      CREATE MULTI LINK languagesOfConsulting: default::Language;
      CREATE LINK pointOfContact: default::User;
      CREATE REQUIRED PROPERTY active: std::bool {
          SET default := true;
      };
      CREATE MULTI PROPERTY financialReportingTypes: Partner::FinancialReportingType;
      CREATE REQUIRED PROPERTY globalInnovationsClient: std::bool {
          SET default := false;
      };
      CREATE PROPERTY pmcEntityCode: std::str {
          CREATE CONSTRAINT std::regexp('^[A-Z]{3}$');
      };
      CREATE MULTI PROPERTY types: Partner::Type;
  };
};
