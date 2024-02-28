CREATE MIGRATION m1efouys27dm25xlcev2h2neozm4evdaskchj2jqjhvqjm5g5i6tkq
    ONTO m1p2k7nnmg7o3qxxzywndo2r4zjwq2bfzi6lqakzhmzvyakc46o6uq
{
  CREATE SCALAR TYPE ProgressReport::Status EXTENDING enum<NotStarted, InProgress, PendingTranslation, InReview, Approved, Published>;
  CREATE TYPE ProgressReport::WorkflowEvent {
      CREATE REQUIRED LINK report: default::ProgressReport {
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY at: std::datetime {
          SET default := (std::datetime_of_statement());
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY status: ProgressReport::Status {
          SET readonly := true;
      };
      CREATE REQUIRED LINK who: default::User {
          SET default := (default::currentUser);
          SET readonly := true;
      };
      CREATE PROPERTY notes: default::RichText {
          SET readonly := true;
      };
      CREATE PROPERTY transitionId: default::nanoid {
          SET readonly := true;
      };
  };
  ALTER TYPE default::ProgressReport {
      CREATE LINK workflowEvents := (.<report[IS ProgressReport::WorkflowEvent]);
      CREATE LINK latestEvent := (SELECT
          .workflowEvents ORDER BY
              .at DESC
      LIMIT
          1
      );
      CREATE PROPERTY status := ((.latestEvent.status ?? ProgressReport::Status.NotStarted));
  };
};
