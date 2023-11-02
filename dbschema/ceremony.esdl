module Engagement {
  abstract type Ceremony extending Resource {
    required planned: bool {
      default := false;
    };
    estimatedDate: cal::local_date;
    actualDate: cal::local_date;
    
    constraint exclusive on (.engagement);
    trigger prohibitDelete after delete for each do (
      assert(
        not exists (__old__.engagement),
        message := "Cannot delete ceremony while engagement still exists."
      )
    );
  }
  type DedicationCeremony extending Ceremony {}
  type CertificationCeremony extending Ceremony {}
}
