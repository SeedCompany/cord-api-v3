module Engagement {
  abstract type Ceremony extending Child {
    required planned: bool {
      default := false;
    };
    estimatedDate: cal::local_date;
    actualDate: cal::local_date;
    
    constraint exclusive on (.engagement);
  }
  type DedicationCeremony extending Ceremony {}
  type CertificationCeremony extending Ceremony {}
}
