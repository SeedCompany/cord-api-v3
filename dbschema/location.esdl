module default {
  type Location extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    required type: Location::Type;
    
    isoAlpha3: Location::IsoAlpha3Code {
      constraint exclusive;
    };
    
    fundingAccount: FundingAccount;
    defaultFieldRegion: FieldRegion;
    defaultMarketingRegion: Location;
    mapImage: File;

    access policy CanReadGeneratedFromAppPoliciesForLocation
    allow select using (
      not exists default::currentUser
    );
    access policy CanCreateGeneratedFromAppPoliciesForLocation
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForLocation
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }
}
  
module Location {
  scalar type Type extending enum<
    Country,
    City,
    County,
    Region,
    State,
    CrossBorderArea
  >;
  
  scalar type IsoAlpha3Code extending str {
    constraint regexp(r'^[A-Z]{3}$');
  }
}
