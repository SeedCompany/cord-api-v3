module default {
  type FundingAccount extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    required accountNumber: int16 {
      constraint expression on (__subject__ >= 0 and __subject__ <= 9);
    }

    access policy CanSelectGeneratedFromAppPoliciesForFundingAccount
    allow select using (
      with
        givenRoles := (<User>(global currentUserId)).roles
      select (
        exists (<Role>{'Administrator', 'ConsultantManager', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect givenRoles)
      )
    );

    access policy CanInsertDeleteGeneratedFromAppPoliciesForFundingAccount
    allow insert, delete using (
      with
        givenRoles := (<User>(global currentUserId)).roles
      select (
        Role.Administrator in givenRoles
      )
    );
  }
}
