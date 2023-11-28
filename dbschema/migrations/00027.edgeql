CREATE MIGRATION m1aqhugpxmkst3yhkmyd5avjuqvbxk7ekgroiipkkhz3ockszv2rka
    ONTO m1ok72bpxjse45mrwdfp2hslsft4pbqqg375z3tqzntv4nqiahsoxq
{
  ALTER TYPE default::Location {
      CREATE LINK defaultFieldRegion: default::FieldRegion;
      CREATE LINK fundingAccount: default::FundingAccount;
  };
};
