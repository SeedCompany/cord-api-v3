module default {
  abstract type PeriodicReport extending Resource, Mixin::Embedded {
    required period: range<cal::local_date>;
    `start` := range_get_lower(.period);
    `end` := date_range_get_upper(.period);
    
    skippedReason: str;
    
    reportFile: File;
    receivedDate: cal::local_date;

    access policy CanReadGeneratedFromAppPoliciesForPeriodicReport
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'Consultant', 'Intern', 'Mentor', 'Translator'} intersect default::currentUser.roles) and (.container[is Project::ContextAware].isMember ?? false))
        or (default::Role.ConsultantManager in default::currentUser.roles and ((.container[is Project::ContextAware].isMember ?? false) or ((.container[is Project::ContextAware].sensitivity <= default::Sensitivity.Medium) ?? false)))
        or (exists (<default::Role>{'Fundraising', 'Marketing'} intersect default::currentUser.roles) and ((.container[is Project::ContextAware].isMember ?? false) or ((.container[is Project::ContextAware].sensitivity <= default::Sensitivity.Medium) ?? false)))
    );
  }
  
  type FinancialReport extending PeriodicReport, Project::Child {
    overloaded container: Project;

    access policy CanReadGeneratedFromAppPoliciesForFinancialReport
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'Consultant', 'Intern', 'Mentor', 'Translator'} intersect default::currentUser.roles) and (.container[is Project::ContextAware].isMember ?? false))
        or (default::Role.ConsultantManager in default::currentUser.roles and ((.container[is Project::ContextAware].isMember ?? false) or ((.container[is Project::ContextAware].sensitivity <= default::Sensitivity.Medium) ?? false)))
        or (exists (<default::Role>{'Fundraising', 'Marketing'} intersect default::currentUser.roles) and ((.container[is Project::ContextAware].isMember ?? false) or ((.container[is Project::ContextAware].sensitivity <= default::Sensitivity.Medium) ?? false)))
    );
  }
  
  type NarrativeReport extending PeriodicReport, Project::Child {
    overloaded container: Project;

    access policy CanReadGeneratedFromAppPoliciesForNarrativeReport
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'Consultant', 'Intern', 'Mentor', 'Translator'} intersect default::currentUser.roles) and (.container[is Project::ContextAware].isMember ?? false))
        or (default::Role.ConsultantManager in default::currentUser.roles and ((.container[is Project::ContextAware].isMember ?? false) or ((.container[is Project::ContextAware].sensitivity <= default::Sensitivity.Medium) ?? false)))
        or (exists (<default::Role>{'Fundraising', 'Marketing'} intersect default::currentUser.roles) and ((.container[is Project::ContextAware].isMember ?? false) or ((.container[is Project::ContextAware].sensitivity <= default::Sensitivity.Medium) ?? false)))
    );
  }
}
