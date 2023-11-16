module default {
  type Partner extending Resource, Project::ContextAware, Mixin::Pinnable, Mixin::Taggable, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }

    required active: bool;
    required globalInnovationsClient: bool;

    pmcEntityCode: str {
      constraint regexp(r'^[A-Z]{3}$');
    }

    #address: str; #TODO - this needs figured out - needed on here and Organization?
    types: array<Partner::Type>;
    financialReportingTypes: array<Partner::FinancialReportingType>;

    pointOfContact: Person;
    languageOfWiderCommunication: Language;

    required organization: Organization {
      constraint exclusive;
    };
    required multi languagesOfConsulting: Language;
    required multi fieldRegions: FieldRegion;
    required multi countries: Location;

    overloaded link projectContext: Project::Context {
      default := (insert Project::Context);
    }
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

  #TODO - probably move to Partnership?
  scalar type FinancialReportingType enum<
    Funded,
    FieldEngaged,
    Hybrid
  >;
}
