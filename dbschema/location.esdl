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
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForLocation
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
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
