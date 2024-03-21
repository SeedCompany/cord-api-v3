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
        givenRoles := (<User>(global currentUserId)).roles,
        isMember := (.container[is Project::ContextAware].isMember ?? false),
        sensitivity := (.container[is Project::ContextAware].sensitivity ?? Sensitivity.High)
      select (
        (
          exists (<Role>{'Administrator', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect givenRoles)
          or (
            exists (<Role>{'ConsultantManager', 'Marketing', 'Fundraising', 'ExperienceOperations'} intersect givenRoles)
            and (
              isMember
              or sensitivity <= Sensitivity.Medium
            )
          )
          or (
            exists (<Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor', 'Translator'} intersect givenRoles)
            and isMember
          )
        )
      )
    );

    access policy CanInsertDeleteGeneratedFromAppPoliciesForPeriodicReport
    allow insert, delete;
  }
  
  type FinancialReport extending PeriodicReport, Project::Child {
    overloaded container: Project;
  }
  
  type NarrativeReport extending PeriodicReport, Project::Child {
    overloaded container: Project;

    access policy CanSelectGeneratedFromAppPoliciesForNarrativeReport
    allow select using (
      with
        givenRoles := (<User>(global currentUserId)).roles,
        isMember := (.container[is Project::ContextAware].isMember ?? false)
      select (
        (
          exists (<Role>{'Consultant', 'ConsultantManager'} intersect givenRoles)
          and isMember
        )
      )
    );
  }
}
