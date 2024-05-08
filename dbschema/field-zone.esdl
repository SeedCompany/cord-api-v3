module default {
  type FieldZone extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    required director: User;
    
    fieldRegions := .<fieldZone[is FieldRegion];

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForFieldZone
    allow select, update read using (
      exists (<Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect global currentRoles)
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForFieldZone
    allow update write;

    access policy CanInsertDeleteGeneratedFromAppPoliciesForFieldZone
    allow insert, delete using (
      Role.Administrator in global currentRoles
    );
  }
}
