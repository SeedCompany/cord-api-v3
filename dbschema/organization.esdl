module default {
  type Organization extending Resource, Project::ContextAware, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    acronym: str;
    #address: str; #TODO - this needs figured out - needed on here and Partner?
    multi types: Organization::Type;
    multi reach: Organization::Reach;

    access policy CanReadGeneratedFromAppPoliciesForOrganization
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'ConsultantManager', 'Controller', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'Consultant', 'FieldPartner'} intersect default::currentUser.roles) and .isMember)
        or (exists (<default::Role>{'ExperienceOperations', 'Fundraising'} intersect default::currentUser.roles) and .sensitivity <= default::Sensitivity.Medium)
        or (default::Role.Marketing in default::currentUser.roles and (.isMember or .sensitivity <= default::Sensitivity.Low))
    );
    access policy CanCreateGeneratedFromAppPoliciesForOrganization
    allow insert using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller', 'FinancialAnalyst', 'LeadFinancialAnalyst'} intersect default::currentUser.roles)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForOrganization
    allow delete using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller'} intersect default::currentUser.roles)
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
