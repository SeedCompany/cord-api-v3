module Engagement {
  abstract type Ceremony extending default::Resource {
    required planned: bool {
      default := false;
    };
    estimatedDate: cal::local_date;
    actualDate: cal::local_date;
  }
  type DedicationCeremony extending Ceremony {}
  type CertificationCeremony extending Ceremony {}
}
