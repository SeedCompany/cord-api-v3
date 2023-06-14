CREATE MIGRATION m1a2sjawhkocczaahomg5inph7oitcdwjmxnkb5km774gb75c4ixya
    ONTO initial
{
  CREATE ABSTRACT TYPE default::Resource {
      CREATE REQUIRED PROPERTY createdAt: std::datetime {
          SET default := (std::datetime_of_statement());
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY modifiedAt: std::datetime {
          CREATE REWRITE
              INSERT
              USING (std::datetime_of_statement());
          CREATE REWRITE
              UPDATE
              USING (std::datetime_of_statement());
      };
  };
  CREATE SCALAR TYPE default::Role EXTENDING enum<Administrator, BetaTester, BibleTranslationLiaison, Consultant, ConsultantManager, Controller, ExperienceOperations, FieldOperationsDirector, FieldPartner, FinancialAnalyst, Fundraising, Intern, LeadFinancialAnalyst, Leadership, Liaison, Marketing, Mentor, ProjectManager, RegionalCommunicationsCoordinator, RegionalDirector, StaffMember, Translator>;
  CREATE SCALAR TYPE default::UserStatus EXTENDING enum<Active, Disabled>;
  CREATE TYPE default::User EXTENDING default::Resource {
      CREATE PROPERTY email: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY about: std::str;
      CREATE REQUIRED PROPERTY realFirstName: std::str;
      CREATE REQUIRED PROPERTY displayFirstName: std::str {
          SET default := (.realFirstName);
      };
      CREATE REQUIRED PROPERTY realLastName: std::str;
      CREATE REQUIRED PROPERTY displayLastName: std::str {
          SET default := (.realLastName);
      };
      CREATE PROPERTY phone: std::str;
      CREATE MULTI PROPERTY roles: default::Role;
      CREATE REQUIRED PROPERTY status: default::UserStatus {
          SET default := (default::UserStatus.Active);
      };
      CREATE PROPERTY timezone: std::str;
      CREATE PROPERTY title: std::str;
  };
  INSERT User {
    realFirstName := 'Root',
    realLastName := 'Admin',
    email := 'devops@tsco.org',
    roles := default::Role.Administrator,
    createdAt := <datetime>'2021-02-13T15:29:18.603Z',
    modifiedAt := <datetime>'2021-02-13T15:29:18.603Z',
  };
  CREATE ALIAS default::RootUser := (
      SELECT
          default::User
      FILTER
          (.email = 'devops@tsco.org')
  );
  CREATE GLOBAL default::currentUserId -> std::uuid;
  CREATE ALIAS default::currentUser := (
      SELECT
          default::User
      FILTER
          (.id = GLOBAL default::currentUserId)
  );
};
