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

    access policy CanReadGeneratedFromAppPoliciesForPartner
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'ConsultantManager', 'Controller', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'Consultant', 'FieldPartner'} intersect default::currentUser.roles) and .isMember)
        or (default::Role.ExperienceOperations in default::currentUser.roles and (.isMember or .sensitivity <= default::Sensitivity.Medium))
        or (default::Role.Fundraising in default::currentUser.roles and (.isMember or .sensitivity <= default::Sensitivity.Medium))
        or (default::Role.Marketing in default::currentUser.roles and ((.isMember and .sensitivity <= default::Sensitivity.Medium) or .sensitivity <= default::Sensitivity.Low))
        or (default::Role.StaffMember in default::currentUser.roles and .sensitivity <= default::Sensitivity.Low)
    );
    access policy CanCreateGeneratedFromAppPoliciesForPartner
    allow insert using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller', 'FinancialAnalyst', 'LeadFinancialAnalyst'} intersect default::currentUser.roles)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForPartner
    allow delete using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller'} intersect default::currentUser.roles)
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
