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
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles,
        isMember := (.container[is Project::ContextAware].isMember ?? false),
        sensitivity := (.container[is Project::ContextAware].sensitivity ?? default::Sensitivity.High)
      select (
        (
          exists (<default::Role>{'Administrator', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect givenRoles)
          or (
            default::Role.ConsultantManager in givenRoles
            and (
              isMember
              or sensitivity <= default::Sensitivity.Medium
            )
          )
          or (
            exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect givenRoles)
            and isMember
          )
          or (
            default::Role.Intern in givenRoles
            and isMember
          )
          or (
            exists (<default::Role>{'Marketing', 'Fundraising', 'ExperienceOperations'} intersect givenRoles)
            and (
              isMember
              or sensitivity <= default::Sensitivity.Medium
            )
          )
          or (
            default::Role.Mentor in givenRoles
            and isMember
          )
          or (
            default::Role.Translator in givenRoles
            and isMember
          )
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
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles,
        isMember := (.container[is Project::ContextAware].isMember ?? false),
        sensitivity := (.container[is Project::ContextAware].sensitivity ?? default::Sensitivity.High)
      select (
        (
          exists (<default::Role>{'Administrator', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect givenRoles)
          or (
            default::Role.ConsultantManager in givenRoles
            and (
              isMember
              or sensitivity <= default::Sensitivity.Medium
            )
          )
          or (
            exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect givenRoles)
            and isMember
          )
          or (
            default::Role.Intern in givenRoles
            and isMember
          )
          or (
            exists (<default::Role>{'Marketing', 'Fundraising', 'ExperienceOperations'} intersect givenRoles)
            and (
              isMember
              or sensitivity <= default::Sensitivity.Medium
            )
          )
          or (
            default::Role.Mentor in givenRoles
            and isMember
          )
          or (
            default::Role.Translator in givenRoles
            and isMember
          )
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
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles,
        isMember := (.container[is Project::ContextAware].isMember ?? false),
        sensitivity := (.container[is Project::ContextAware].sensitivity ?? default::Sensitivity.High)
      select (
        (
          exists (<default::Role>{'Administrator', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect givenRoles)
          or (
            default::Role.ConsultantManager in givenRoles
            and (
              isMember
              or sensitivity <= default::Sensitivity.Medium
            )
          )
          or (
            exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect givenRoles)
            and isMember
          )
          or (
            default::Role.Intern in givenRoles
            and isMember
          )
          or (
            exists (<default::Role>{'Marketing', 'Fundraising', 'ExperienceOperations'} intersect givenRoles)
            and (
              isMember
              or sensitivity <= default::Sensitivity.Medium
            )
          )
          or (
            default::Role.Mentor in givenRoles
            and isMember
          )
          or (
            default::Role.Translator in givenRoles
            and isMember
          )
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForNarrativeReport
    allow insert;

    access policy CanDeleteGeneratedFromAppPoliciesForNarrativeReport
    allow delete;
  }
}
