module default {
  type Organization extending Resource, Project::ContextAware, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    acronym: str;
    #TODO - this needs figured out - needed on here and Partner?
    address: str;
    multi types: Organization::Type;
    multi reach: Organization::Reach;

    multi locations: Location;

    overloaded link projectContext: Project::Context {
      default := (insert Project::Context);
      on source delete delete target;
    }

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForOrganization
    allow select, update read using (
      (
        exists (<Role>{'Administrator', 'ConsultantManager', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect global currentRoles)
        or (
          exists (<Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} intersect global currentRoles)
          and .isMember
        )
        or (
          exists (<Role>{'ExperienceOperations', 'Fundraising'} intersect global currentRoles)
          and .sensitivity <= Sensitivity.Medium
        )
        or (
          Role.Marketing in global currentRoles
          and (
            .isMember
            or .sensitivity <= Sensitivity.Low
          )
        )
      )
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForOrganization
    allow update write;

    access policy CanInsertGeneratedFromAppPoliciesForOrganization
    allow insert using (
      exists (<Role>{'Administrator', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} intersect global currentRoles)
    );

    access policy CanDeleteGeneratedFromAppPoliciesForOrganization
    allow delete using (
      exists (<Role>{'Administrator', 'Controller'} intersect global currentRoles)
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
