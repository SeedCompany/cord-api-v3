module default {
  type FieldRegion extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    required fieldZone: FieldZone;
    required director: User;

    access policy CanReadGeneratedFromAppPoliciesForFieldRegion
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'Fundraising', 'LeadFinancialAnalyst', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect default::currentUser.roles)
    );
    access policy CanCreateGeneratedFromAppPoliciesForFieldRegion
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForFieldRegion
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }
}
