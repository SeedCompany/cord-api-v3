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
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect givenRoles)
      )
    );

    access policy CanInsertDeleteGeneratedFromAppPoliciesForFieldZone
    allow insert, delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );
  }
}
