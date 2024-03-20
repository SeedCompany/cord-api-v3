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
      (
        exists (<default::Role>{'Administrator', 'ConsultantManager', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect (<default::User>(global default::currentUserId)).roles)
          and .isMember
        )
        or (
          default::Role.ExperienceOperations in (<default::User>(global default::currentUserId)).roles
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
        or (
          default::Role.FieldPartner in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
        or (
          default::Role.Fundraising in (<default::User>(global default::currentUserId)).roles
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
        or (
          default::Role.Marketing in (<default::User>(global default::currentUserId)).roles
          and (
            (
              .isMember
              and .sensitivity <= default::Sensitivity.Medium
            )
            or .sensitivity <= default::Sensitivity.Low
          )
        )
        or (
          default::Role.StaffMember in (<default::User>(global default::currentUserId)).roles
          and .sensitivity <= default::Sensitivity.Low
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForPartner
    allow insert using (
      exists (<default::Role>{'Administrator', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} intersect (<default::User>(global default::currentUserId)).roles)
    );

    access policy CanDeleteGeneratedFromAppPoliciesForPartner
    allow delete using (
      exists (<default::Role>{'Administrator', 'Controller'} intersect (<default::User>(global default::currentUserId)).roles)
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
