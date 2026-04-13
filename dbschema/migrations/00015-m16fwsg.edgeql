CREATE MIGRATION m16fwsgh2jrwv2pxyw3ej36uywbt7dhnyfankwp4sq3oqwtv2alydq
    ONTO m1l7uuqm3my5klng3a2m6wqoswaq63h6jb63gvioafpj2t5yffxduq
{
  CREATE MODULE Business IF NOT EXISTS;
  CREATE MODULE Program IF NOT EXISTS;
  CREATE SCALAR TYPE Business::`Group` EXTENDING enum<Development, FieldGrowth, FieldOperations, Finance, MarketingCommunications, OfficeOfThePresident, People, Technology> {
      CREATE ANNOTATION std::description := 'Each group (formerly domain) within Seed Company. OrganizationGroup was avoided to not be ambiguous with our Organizations here.';
  };
  CREATE TYPE Program::Approver {
      CREATE REQUIRED LINK user: default::User {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED MULTI PROPERTY groups: Business::`Group`;
      CREATE REQUIRED MULTI PROPERTY programs: Project::Type;
      CREATE ANNOTATION std::description := 'Certain users are approvers on behalf of their group for certain programs / project types.';
  };
  ALTER TYPE default::Project {
      CREATE MULTI LINK approvers := (SELECT
          Program::Approver
      FILTER
          (default::Project.type IN .programs)
      );
      CREATE SINGLE LINK approver := (SELECT
          .approvers FILTER
              (.user = GLOBAL default::currentUser)
      LIMIT
          1
      );
  };
  ALTER TYPE Project::ContextAware {
      CREATE REQUIRED SINGLE PROPERTY isFinancialApprover := (EXISTS ((SELECT
          .projectContext.projects.approver
      FILTER
          (Business::`Group`.Finance IN .groups)
      )));
  };
};
