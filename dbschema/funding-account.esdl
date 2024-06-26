module default {
  type FundingAccount extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    required accountNumber: int16 {
      constraint expression on (__subject__ >= 0 and __subject__ <= 9);
    }

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForFundingAccount
    allow select, update read using (
      exists (<Role>{'Administrator', 'ConsultantManager', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect global currentRoles)
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForFundingAccount
    allow update write;

    access policy CanInsertDeleteGeneratedFromAppPoliciesForFundingAccount
    allow insert, delete using (
      Role.Administrator in global currentRoles
    );
  }
}
