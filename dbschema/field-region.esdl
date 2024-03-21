module default {
  type FieldRegion extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    required fieldZone: FieldZone;
    required director: User;

    access policy CanSelectGeneratedFromAppPoliciesForFieldRegion
    allow select using (
      with
        givenRoles := (<User>(global currentUserId)).roles
      select (
        exists (<Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect givenRoles)
      )
    );

    access policy CanInsertDeleteGeneratedFromAppPoliciesForFieldRegion
    allow insert, delete using (
      with
        givenRoles := (<User>(global currentUserId)).roles
      select (
        Role.Administrator in givenRoles
      )
    );
  }
}
