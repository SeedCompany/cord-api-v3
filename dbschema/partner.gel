module default {
  type Partner extending
    Mixin::Postable,
    Comments::Aware,
    Resource,
    Project::ContextAware,
    Mixin::Named,
    Mixin::Pinnable,
    Mixin::Taggable
  {
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
    multi approvedPrograms: Project::Type;
    
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
