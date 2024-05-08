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
    
    #TODO - this needs figured out - needed on here and Organization?
    address: str;
    multi types: Partner::Type;
    multi financialReportingTypes: Partnership::FinancialReportingType;
    
    pointOfContact: User;
    languageOfWiderCommunication: Language;
    
    required organization: Organization {
      readonly := true;
      constraint exclusive;
      on source delete delete target;
      on target delete delete source;
    };
    multi languagesOfConsulting: Language;
    multi fieldRegions: FieldRegion;
    multi countries: Location;

    startDate: cal::local_date;

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForPartner
    allow select, update read using (
      (
        exists (<Role>{'Administrator', 'ConsultantManager', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector'} intersect global currentRoles)
        or (
          exists (<Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} intersect global currentRoles)
          and .isMember
        )
        or (
          exists (<Role>{'ExperienceOperations', 'Fundraising'} intersect global currentRoles)
          and (
            .isMember
            or .sensitivity <= Sensitivity.Medium
          )
        )
        or (
          Role.Marketing in global currentRoles
          and (
            (
              .isMember
              and .sensitivity <= Sensitivity.Medium
            )
            or .sensitivity <= Sensitivity.Low
          )
        )
        or (
          Role.StaffMember in global currentRoles
          and .sensitivity <= Sensitivity.Low
        )
      )
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForPartner
    allow update write;

    access policy CanInsertGeneratedFromAppPoliciesForPartner
    allow insert using (
      exists (<Role>{'Administrator', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} intersect global currentRoles)
    );

    access policy CanDeleteGeneratedFromAppPoliciesForPartner
    allow delete using (
      exists (<Role>{'Administrator', 'Controller'} intersect global currentRoles)
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
