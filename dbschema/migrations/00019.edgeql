CREATE MIGRATION m16iocvtxxrlcx2ireyxh66ma6ti5tpi3hr7jga2lnfjvoi2nez3ha
    ONTO m1v6vmh2owlqk4hmin44txizh64lrl6xjo4rlay4gyfk3sjskyqe2q
{
  ALTER TYPE default::InternshipEngagement {
      CREATE TRIGGER connectCertificationCeremony
          AFTER INSERT 
          FOR EACH DO (INSERT
              Engagement::CertificationCeremony
              {
                  createdAt := std::datetime_of_statement(),
                  engagement := __new__,
                  project := __new__.project,
                  projectContext := __new__.projectContext
              });
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE TRIGGER connectDedicationCeremony
          AFTER INSERT 
          FOR EACH DO (INSERT
              Engagement::DedicationCeremony
              {
                  createdAt := std::datetime_of_statement(),
                  engagement := __new__,
                  project := __new__.project,
                  projectContext := __new__.projectContext
              });
  };
};
