module default {
  abstract type PeriodicReport extending Resource, Mixin::Embedded {
    required period: range<cal::local_date>;
    `start` := range_get_lower(.period);
    `end` := date_range_get_upper(.period);
    
    skippedReason: str;
    
    reportFile: File;
    receivedDate: cal::local_date;

    access policy CanSelectGeneratedFromAppPoliciesForPeriodicReport
    allow select using (
      (
        exists (<default::Role>{'Administrator', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          default::Role.ConsultantManager in (<default::User>(global default::currentUserId)).roles
          and (
            (.container[is Project::ContextAware].isMember ?? false)
            or ((.container[is Project::ContextAware].sensitivity <= default::Sensitivity.Medium) ?? false)
          )
        )
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect (<default::User>(global default::currentUserId)).roles)
          and (.container[is Project::ContextAware].isMember ?? false)
        )
        or (
          default::Role.Intern in (<default::User>(global default::currentUserId)).roles
          and (.container[is Project::ContextAware].isMember ?? false)
        )
        or (
          exists (<default::Role>{'Marketing', 'Fundraising', 'ExperienceOperations'} intersect (<default::User>(global default::currentUserId)).roles)
          and (
            (.container[is Project::ContextAware].isMember ?? false)
            or ((.container[is Project::ContextAware].sensitivity <= default::Sensitivity.Medium) ?? false)
          )
        )
        or (
          default::Role.Mentor in (<default::User>(global default::currentUserId)).roles
          and (.container[is Project::ContextAware].isMember ?? false)
        )
        or (
          default::Role.Translator in (<default::User>(global default::currentUserId)).roles
          and (.container[is Project::ContextAware].isMember ?? false)
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForPeriodicReport
    allow insert;

    access policy CanDeleteGeneratedFromAppPoliciesForPeriodicReport
    allow delete;
  }
  
  type FinancialReport extending PeriodicReport, Project::Child {
    overloaded container: Project;

    access policy CanSelectGeneratedFromAppPoliciesForFinancialReport
    allow select using (
      (
        exists (<default::Role>{'Administrator', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          default::Role.ConsultantManager in (<default::User>(global default::currentUserId)).roles
          and (
            (.container[is Project::ContextAware].isMember ?? false)
            or ((.container[is Project::ContextAware].sensitivity <= default::Sensitivity.Medium) ?? false)
          )
        )
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect (<default::User>(global default::currentUserId)).roles)
          and (.container[is Project::ContextAware].isMember ?? false)
        )
        or (
          default::Role.Intern in (<default::User>(global default::currentUserId)).roles
          and (.container[is Project::ContextAware].isMember ?? false)
        )
        or (
          exists (<default::Role>{'Marketing', 'Fundraising', 'ExperienceOperations'} intersect (<default::User>(global default::currentUserId)).roles)
          and (
            (.container[is Project::ContextAware].isMember ?? false)
            or ((.container[is Project::ContextAware].sensitivity <= default::Sensitivity.Medium) ?? false)
          )
        )
        or (
          default::Role.Mentor in (<default::User>(global default::currentUserId)).roles
          and (.container[is Project::ContextAware].isMember ?? false)
        )
        or (
          default::Role.Translator in (<default::User>(global default::currentUserId)).roles
          and (.container[is Project::ContextAware].isMember ?? false)
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForFinancialReport
    allow insert;

    access policy CanDeleteGeneratedFromAppPoliciesForFinancialReport
    allow delete;
  }
  
  type NarrativeReport extending PeriodicReport, Project::Child {
    overloaded container: Project;

    access policy CanSelectGeneratedFromAppPoliciesForNarrativeReport
    allow select using (
      (
        exists (<default::Role>{'Administrator', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          default::Role.ConsultantManager in (<default::User>(global default::currentUserId)).roles
          and (
            (.container[is Project::ContextAware].isMember ?? false)
            or ((.container[is Project::ContextAware].sensitivity <= default::Sensitivity.Medium) ?? false)
          )
        )
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect (<default::User>(global default::currentUserId)).roles)
          and (.container[is Project::ContextAware].isMember ?? false)
        )
        or (
          default::Role.Intern in (<default::User>(global default::currentUserId)).roles
          and (.container[is Project::ContextAware].isMember ?? false)
        )
        or (
          exists (<default::Role>{'Marketing', 'Fundraising', 'ExperienceOperations'} intersect (<default::User>(global default::currentUserId)).roles)
          and (
            (.container[is Project::ContextAware].isMember ?? false)
            or ((.container[is Project::ContextAware].sensitivity <= default::Sensitivity.Medium) ?? false)
          )
        )
        or (
          default::Role.Mentor in (<default::User>(global default::currentUserId)).roles
          and (.container[is Project::ContextAware].isMember ?? false)
        )
        or (
          default::Role.Translator in (<default::User>(global default::currentUserId)).roles
          and (.container[is Project::ContextAware].isMember ?? false)
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForNarrativeReport
    allow insert;

    access policy CanDeleteGeneratedFromAppPoliciesForNarrativeReport
    allow delete;
  }
}
