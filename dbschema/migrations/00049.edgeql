CREATE MIGRATION m1kzwpoy3r3awvbzqxxzz3upkkemxjtf33ra53zkuxzexsc7r5x4zq
    ONTO m1tn7o5vizqaygjvghqysxzw6ruf4xohudb2usgfg4z622ens24mba
{
  CREATE MODULE Partnership IF NOT EXISTS;
  ALTER SCALAR TYPE Partner::FinancialReportingType RENAME TO Partnership::FinancialReportingType;
  CREATE SCALAR TYPE Partnership::AgreementStatus EXTENDING enum<NotAttached, AwaitingSignature, Signed>;
  CREATE TYPE default::Partnership EXTENDING Project::Child {
      CREATE REQUIRED LINK partner: default::Partner;
      CREATE CONSTRAINT std::exclusive ON ((.project, .partner));
      CREATE LINK agreement: default::File;
      CREATE LINK mou: default::File;
      CREATE LINK organization := (.partner.organization);
      CREATE PROPERTY mouEndOverride: cal::local_date;
      CREATE PROPERTY mouEnd := ((.mouEndOverride ?? .project.mouEnd));
      CREATE PROPERTY mouStartOverride: cal::local_date;
      CREATE PROPERTY mouStart := ((.mouStartOverride ?? .project.mouStart));
      CREATE REQUIRED PROPERTY agreementStatus: Partnership::AgreementStatus {
          SET default := (Partnership::AgreementStatus.NotAttached);
      };
      CREATE PROPERTY financialReportingType: Partnership::FinancialReportingType;
      CREATE REQUIRED PROPERTY mouStatus: Partnership::AgreementStatus {
          SET default := (Partnership::AgreementStatus.NotAttached);
      };
      CREATE REQUIRED PROPERTY primary: std::bool {
          SET default := false;
      };
      CREATE MULTI PROPERTY types: Partner::Type;
  };
  ALTER TYPE default::Project {
      CREATE LINK partnerships := (.<project[IS default::Partnership]);
  };
};
