module Product {
  type PartnershipProducingMedium extending Engagement::Child {
    required medium: Medium;
    required partnership: default::Partnership {
      readonly := true;
      on target delete delete source;
    };

    constraint exclusive on ((.engagement, .partnership, .medium))


  }
}
