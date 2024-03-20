module default {
  type Organization extending Resource, Project::ContextAware, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    acronym: str;
    #address: str; #TODO - this needs figured out - needed on here and Partner?
    multi types: Organization::Type;
    multi reach: Organization::Reach;

    access policy CanSelectGeneratedFromAppPoliciesForOrganization
    allow select using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        (
          exists (<default::Role>{'Administrator', 'ConsultantManager', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect givenRoles)
          or (
            exists (<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} intersect givenRoles)
            and .isMember
          )
          or (
            exists (<default::Role>{'ExperienceOperations', 'Fundraising'} intersect givenRoles)
            and .sensitivity <= default::Sensitivity.Medium
          )
          or (
            default::Role.Marketing in givenRoles
            and (
              .isMember
              or .sensitivity <= default::Sensitivity.Low
            )
          )
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForOrganization
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} intersect givenRoles)
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForOrganization
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'Controller'} intersect givenRoles)
      )
    );
  }
}
  
module Organization {
  scalar type Type extending enum<
    Church,
    Parachurch,
    Mission,
    TranslationOrganization,
    Alliance
  >;
  
  scalar type Reach extending enum<
    Local,
    Regional,
    National,
    `Global`
  >;
}
