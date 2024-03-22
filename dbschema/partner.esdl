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
