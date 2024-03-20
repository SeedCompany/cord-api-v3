module Project {
  type Member extending Child {
    required user: default::User {
      readonly := true;
      on target delete delete source;
    };
    constraint exclusive on ((.project, .user));
    
    multi roles: default::Role;

    access policy CanReadGeneratedFromAppPoliciesForProjectMember
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FinancialAnalyst', 'Fundraising', 'LeadFinancialAnalyst', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'Consultant', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} intersect default::currentUser.roles) and .isMember)
    );
    access policy CanCreateGeneratedFromAppPoliciesForProjectMember
    allow insert using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'FinancialAnalyst', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles) and .isMember)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForProjectMember
    allow delete using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'FinancialAnalyst', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles) and .isMember)
    );
  }
}
