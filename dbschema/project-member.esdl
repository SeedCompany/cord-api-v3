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
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        (
          exists (<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect givenRoles)
          or (
            exists (<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} intersect givenRoles)
            and .isMember
          )
        )
      )
    );

    access policy CanInsertDeleteGeneratedFromAppPoliciesForProjectMember
    allow insert, delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        (
          exists (<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} intersect givenRoles)
          or (
            exists (<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect givenRoles)
            and .isMember
          )
        )
      )
    );
  }
}
