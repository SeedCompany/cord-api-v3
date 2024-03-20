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

    access policy CanSelectGeneratedFromAppPoliciesForLocation
    allow select;

    access policy CanInsertGeneratedFromAppPoliciesForLocation
    allow insert using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );

    access policy CanDeleteGeneratedFromAppPoliciesForLocation
    allow delete using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
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
