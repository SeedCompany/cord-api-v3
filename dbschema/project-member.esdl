module Project {
  type Member extending Child {
    required user: default::User {
      readonly := true;
      on target delete delete source;
    };
    constraint exclusive on ((.project, .user));
    
    multi roles: default::Role;

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProjectMember
    allow select, update read using (
      (
        exists (<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect global default::currentRoles)
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} intersect global default::currentRoles)
          and .isMember
        )
      )
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForProjectMember
    allow update write;

    access policy CanInsertDeleteGeneratedFromAppPoliciesForProjectMember
    allow insert, delete using (
      (
        exists (<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} intersect global default::currentRoles)
        or (
          exists (<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
          and .isMember
        )
      )
    );
  }
}
