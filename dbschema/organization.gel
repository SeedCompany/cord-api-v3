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
