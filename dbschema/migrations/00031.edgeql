CREATE MIGRATION m1wzaeho6j66fhwcmgkeezkp52hqwxgc27uy7yqsdgml3qekc2iarq
    ONTO m1f6w2tfwomhiwhtzwnpraqfo24x3rnfcpnntt7nxe5f5l7utyjzpa
{
  ALTER TYPE default::InternshipEngagement {
      ALTER TRIGGER connectCertificationCeremony USING (INSERT
          Engagement::CertificationCeremony
          {
              createdAt := std::datetime_of_statement(),
              modifiedAt := std::datetime_of_statement(),
              engagement := __new__,
              project := __new__.project,
              projectContext := __new__.projectContext
          });
  };
  ALTER TYPE default::Project {
      ALTER TRIGGER createBudgetOnInsert USING (INSERT
          default::Budget
          {
              createdAt := std::datetime_of_statement(),
              modifiedAt := std::datetime_of_statement(),
              project := __new__,
              projectContext := __new__.projectContext
          });
  };
  ALTER TYPE default::LanguageEngagement {
      ALTER TRIGGER connectDedicationCeremony USING (INSERT
          Engagement::DedicationCeremony
          {
              createdAt := std::datetime_of_statement(),
              modifiedAt := std::datetime_of_statement(),
              engagement := __new__,
              project := __new__.project,
              projectContext := __new__.projectContext
          });
  };
};
