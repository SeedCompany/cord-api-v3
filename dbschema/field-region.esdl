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
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect givenRoles)
      )
    );

    access policy CanInsertDeleteGeneratedFromAppPoliciesForFieldRegion
    allow insert, delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );
  }
}
