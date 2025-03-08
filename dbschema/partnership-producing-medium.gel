module Product {
  type PartnershipProducingMedium extending Engagement::Child {
    required partnership: default::Partnership {
      readonly := true;
      on target delete delete source;
    };
    required medium: Medium;
    
    constraint exclusive on ((.engagement, .partnership, .medium))
  }
}
