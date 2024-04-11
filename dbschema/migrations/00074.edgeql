CREATE MIGRATION m1my4gnalxbdroxdfajzul5nmhg3jhwnmogtt2wxv2hrzv2p7tj2xa
    ONTO m15sissgmcapfcx2mkqx3plubij4nmkn7r4hk73blnususy6il3hpq
{
  ALTER TYPE default::Engagement {
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForEngagement USING (WITH
          givenRoles := 
              (<default::User>GLOBAL default::currentUserId).roles
      SELECT
          ((default::Role.Administrator IN givenRoles) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles)) AND .isMember) AND (<std::str>.project.status = 'InDevelopment')))
      );
  };
};
