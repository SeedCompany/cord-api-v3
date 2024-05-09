CREATE MIGRATION m1gq2hsptfudyqzcqhaz3o5ikdckynzcdegdixqtrdtnisldpyqv6a
    ONTO m1s2cbqfqayiw2giggpp3dlfwrxnmpaziw7irc4h74chugwr4noluq
{
  CREATE SCALAR TYPE Project::Type EXTENDING enum<MomentumTranslation, MultiplicationTranslation, Internship>;
  CREATE TYPE Project::FinancialApprover {
    CREATE REQUIRED LINK user: default::User {
      CREATE CONSTRAINT std::exclusive;
    };
    CREATE REQUIRED MULTI PROPERTY projectTypes: Project::Type;
    CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFinancialApprover
      ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
    CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFinancialApprover
      ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT GLOBAL default::currentRoles)));
    CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFinancialApprover
      ALLOW UPDATE WRITE;
  };
};
