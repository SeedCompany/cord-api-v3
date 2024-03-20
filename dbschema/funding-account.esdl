module default {
  type FundingAccount extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    required accountNumber: int16 {
      constraint expression on (__subject__ >= 0 and __subject__ <= 9);
    }

    access policy CanReadGeneratedFromAppPoliciesForFundingAccount
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'ConsultantManager', 'Controller', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect default::currentUser.roles)
    );
    access policy CanCreateGeneratedFromAppPoliciesForFundingAccount
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForFundingAccount
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }
}
