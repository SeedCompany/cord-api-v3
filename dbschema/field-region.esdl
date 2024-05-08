module default {
  type FieldRegion extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    required fieldZone: FieldZone;
    required director: User;

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForFieldRegion
    allow select, update read using (
      exists (<Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect global currentRoles)
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForFieldRegion
    allow update write;

    access policy CanInsertDeleteGeneratedFromAppPoliciesForFieldRegion
    allow insert, delete using (
      Role.Administrator in global currentRoles
    );
  }
}
