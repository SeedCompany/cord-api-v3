CREATE MIGRATION m1xzmkyesmqv2ivg4gjj6zmh5kdalfwgndnst356xk4i524hvyibtq
    ONTO m1hnb27oqqkof3lnba4yzfccxjq5ca55g3jz7dsacix6cafqhqrvcq
{
  ALTER TYPE Mixin::Timestamped {
    ALTER PROPERTY createdAt {
      SET default := (std::datetime_of_transaction());
    };
    ALTER PROPERTY modifiedAt {
      SET default := (std::datetime_of_transaction());
      DROP REWRITE UPDATE;
      CREATE REWRITE UPDATE USING (std::datetime_of_transaction());
    };
  };
  ALTER TYPE default::InternshipEngagement {
    ALTER TRIGGER connectCertificationCeremony USING (
      INSERT Engagement::CertificationCeremony {
        createdAt := std::datetime_of_transaction(),
        modifiedAt := std::datetime_of_transaction(),
        createdBy := std::assert_exists(GLOBAL default::currentActor),
        modifiedBy := std::assert_exists(GLOBAL default::currentActor),
        engagement := __new__,
        project := __new__.project,
        projectContext := __new__.projectContext
      }
    );
  };
  ALTER TYPE default::LanguageEngagement {
    ALTER TRIGGER connectDedicationCeremony USING (
      INSERT Engagement::DedicationCeremony {
        createdAt := std::datetime_of_transaction(),
        modifiedAt := std::datetime_of_transaction(),
        createdBy := std::assert_exists(GLOBAL default::currentActor),
        modifiedBy := std::assert_exists(GLOBAL default::currentActor),
        engagement := __new__,
        project := __new__.project,
        projectContext := __new__.projectContext
      }
    );
  };
  ALTER TYPE ProgressReport::WorkflowEvent {
    ALTER PROPERTY at {
      SET default := (std::datetime_of_transaction());
    };
  };
  ALTER TYPE Project::WorkflowEvent {
    ALTER PROPERTY at {
      SET default := (std::datetime_of_transaction());
    };
  };
  ALTER TYPE default::Project {
    ALTER TRIGGER createBudgetOnInsert USING (
      INSERT default::Budget {
        createdAt := std::datetime_of_transaction(),
        modifiedAt := std::datetime_of_transaction(),
        createdBy := std::assert_exists(GLOBAL default::currentActor),
        modifiedBy := std::assert_exists(GLOBAL default::currentActor),
        project := __new__,
        projectContext := __new__.projectContext
      }
    );
  };
  ALTER TYPE default::Engagement {
    ALTER PROPERTY lastReactivatedAt {
      DROP REWRITE UPDATE;
      CREATE REWRITE UPDATE USING ((std::datetime_of_transaction() IF (((.status != __old__.status) AND (.status = Engagement::Status.Active)) AND (__old__.status = Engagement::Status.Suspended)) ELSE .lastReactivatedAt));
    };
    ALTER PROPERTY lastSuspendedAt {
      DROP REWRITE UPDATE;
      CREATE REWRITE UPDATE USING ((std::datetime_of_transaction() IF ((.status != __old__.status) AND (.status = Engagement::Status.Suspended)) ELSE .lastSuspendedAt));
    };
    ALTER PROPERTY statusModifiedAt {
      DROP REWRITE UPDATE;
      CREATE REWRITE UPDATE USING ((std::datetime_of_transaction() IF (.status != __old__.status) ELSE .statusModifiedAt));
    };
  };
};
