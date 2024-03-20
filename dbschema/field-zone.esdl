module default {
  type FieldZone extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    required director: User;
    
    fieldRegions := .<fieldZone[is FieldRegion];

    access policy CanReadGeneratedFromAppPoliciesForFieldZone
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'Fundraising', 'LeadFinancialAnalyst', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect default::currentUser.roles)
    );
    access policy CanCreateGeneratedFromAppPoliciesForFieldZone
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForFieldZone
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }
}
