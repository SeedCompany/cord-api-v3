module default {
  type FieldZone extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    required director: User;
    
    fieldRegions := .<fieldZone[is FieldRegion];

    access policy CanSelectGeneratedFromAppPoliciesForFieldZone
    allow select using (
      with
        givenRoles := (<User>(global currentUserId)).roles
      select (
        exists (<Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect givenRoles)
      )
    );

    access policy CanInsertDeleteGeneratedFromAppPoliciesForFieldZone
    allow insert, delete using (
      with
        givenRoles := (<User>(global currentUserId)).roles
      select (
        Role.Administrator in givenRoles
      )
    );
  }
}
