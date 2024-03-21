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

    access policy CanInsertDeleteGeneratedFromAppPoliciesForLocation
    allow insert, delete using (
      with
        givenRoles := (<User>(global currentUserId)).roles
      select (
        Role.Administrator in givenRoles
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
