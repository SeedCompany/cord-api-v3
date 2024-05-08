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

    access policy CanSelectUpdateReadUpdateWriteGeneratedFromAppPoliciesForLocation
    allow select, update read, update write;

    access policy CanInsertDeleteGeneratedFromAppPoliciesForLocation
    allow insert, delete using (
      Role.Administrator in global currentRoles
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
