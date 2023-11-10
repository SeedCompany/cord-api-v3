module default {
  type Location extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    required type: Location::Type;

    isoAlpha3: Location::IsoAlpha3Code {
      constraint exclusive;
    };

    #TODO - links
    #fundingAccount: FundingAccount;
    #defaultFieldRegion: FieldRegion;
    #mapImage: File;
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
