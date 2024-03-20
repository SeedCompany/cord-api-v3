module default {
  type Partner extending Mixin::Postable, Resource, Project::ContextAware, Mixin::Named, Mixin::Pinnable, Mixin::Taggable {
    overloaded name {
      constraint exclusive;
    }
    
    required active: bool {
      default := true;
    };
    required globalInnovationsClient: bool {
      default := false;
    };
    
    pmcEntityCode: str {
      constraint regexp(r'^[A-Z]{3}$');
    }
    
    #address: str; #TODO - this needs figured out - needed on here and Organization?
    multi types: Partner::Type;
    multi financialReportingTypes: Partnership::FinancialReportingType;
    
    pointOfContact: User;
    languageOfWiderCommunication: Language;
    
    required organization: Organization {
      readonly := true;
      constraint exclusive;
    };
    multi languagesOfConsulting: Language;
    multi fieldRegions: FieldRegion;
    multi countries: Location;

    access policy CanSelectGeneratedFromAppPoliciesForPartner
    allow select using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        (
          exists (<default::Role>{'Administrator', 'ConsultantManager', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector'} intersect givenRoles)
          or (
            exists (<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} intersect givenRoles)
            and .isMember
          )
          or (
            exists (<default::Role>{'ExperienceOperations', 'Fundraising'} intersect givenRoles)
            and (
              .isMember
              or .sensitivity <= default::Sensitivity.Medium
            )
          )
          or (
            default::Role.Marketing in givenRoles
            and (
              (
                .isMember
                and .sensitivity <= default::Sensitivity.Medium
              )
              or .sensitivity <= default::Sensitivity.Low
            )
          )
          or (
            default::Role.StaffMember in givenRoles
            and .sensitivity <= default::Sensitivity.Low
          )
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForPartner
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} intersect givenRoles)
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForPartner
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'Controller'} intersect givenRoles)
      )
    );
  }
}
  
module Partner {
  scalar type Type extending enum<
    Managing,
    Funding,
    Impact,
    Technical,
    Resource
  >;
}
