CREATE MIGRATION m1d2nmzhgsu7jc75xtbjt4zdvroszkfcbtmdrap2kohcto4fbpqoia
    ONTO m1tj2f3et7fsl4f3fainebzekv3tawlwplulftdv35tfzymidhi6ga
{
  ALTER TYPE default::Engagement {
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForEngagement USING (((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND ((<std::str>.project.status = 'InDevelopment') OR (<std::str>.project.step = 'DiscussingChangeToPlan'))));
  };
};
