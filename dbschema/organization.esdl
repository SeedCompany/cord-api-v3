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
      (
        exists (<default::Role>{'Administrator', 'ConsultantManager', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect (<default::User>(global default::currentUserId)).roles)
          and .isMember
        )
        or (
          default::Role.ExperienceOperations in (<default::User>(global default::currentUserId)).roles
          and .sensitivity <= default::Sensitivity.Medium
        )
        or (
          default::Role.FieldPartner in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
        or (
          default::Role.Fundraising in (<default::User>(global default::currentUserId)).roles
          and .sensitivity <= default::Sensitivity.Medium
        )
        or (
          default::Role.Marketing in (<default::User>(global default::currentUserId)).roles
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Low
          )
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForOrganization
    allow insert using (
      exists (<default::Role>{'Administrator', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} intersect (<default::User>(global default::currentUserId)).roles)
    );

    access policy CanDeleteGeneratedFromAppPoliciesForOrganization
    allow delete using (
      exists (<default::Role>{'Administrator', 'Controller'} intersect (<default::User>(global default::currentUserId)).roles)
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
