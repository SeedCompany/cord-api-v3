module Project {
  type Member extending Child {
    required user: default::User {
      readonly := true;
      on target delete delete source;
    };
    constraint exclusive on ((.project, .user));
    
    multi roles: default::Role;

    access policy CanSelectGeneratedFromAppPoliciesForProjectMember
    allow select using (
      (
        exists (<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect (<default::User>(global default::currentUserId)).roles)
          and .isMember
        )
        or (
          default::Role.FieldPartner in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
        or (
          default::Role.Intern in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
        or (
          default::Role.Mentor in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
        or (
          default::Role.Translator in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForProjectMember
    allow insert using (
      (
        exists (<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          exists (<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} intersect (<default::User>(global default::currentUserId)).roles)
          and .isMember
        )
        or (
          exists (<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect (<default::User>(global default::currentUserId)).roles)
          and .isMember
        )
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForProjectMember
    allow delete using (
      (
        exists (<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          exists (<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} intersect (<default::User>(global default::currentUserId)).roles)
          and .isMember
        )
        or (
          exists (<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect (<default::User>(global default::currentUserId)).roles)
          and .isMember
        )
      )
    );
  }
}
