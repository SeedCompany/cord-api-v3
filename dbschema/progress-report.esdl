module default {
  type ProgressReport extending PeriodicReport, Engagement::Child {
    overloaded container: LanguageEngagement;
    overloaded engagement: LanguageEngagement;

    status := .latestEvent.status ?? ProgressReport::Status.NotStarted;
    latestEvent := (select .workflowEvents order by .at desc limit 1);
    workflowEvents := .<report[is ProgressReport::WorkflowEvent];

    single varianceExplanation := .<report[is ProgressReport::VarianceExplanation];
  }
}

module ProgressReport {
  abstract type Child extending Engagement::Child {
    annotation description := "\
      A type that is a child of a progress report. \

      It will always have a reference to a single progress report and engagement that it is under.";

    required report: default::ProgressReport {
      readonly := true;
      on target delete delete source;
    };

    trigger enforceProgressReportEngagement after insert, update for each do (
      assert(
        __new__.report.engagement = __new__.engagement,
        message := "Given progress report must be for the same engagement as the given engagement"
      )
    );
  }

  type VarianceExplanation extending ProgressReport::Child {
    overloaded report {
      constraint exclusive;
    };

    multi reasons: str; 

    comments: default::RichText;
  }

  type WorkflowEvent {
    required report: default::ProgressReport {
      readonly := true;
    };
    required who: default::User {
      readonly := true;
      default := default::currentUser;
    };
    required at: datetime {
      readonly := true;
      default := datetime_of_statement();
    };
    transitionId: default::nanoid {
      readonly := true;
    };
    required status: Status {
      readonly := true;
    };
    notes: default::RichText {
      readonly := true;
    };
  }

  scalar type Status extending enum<
    NotStarted,
    InProgress,
    PendingTranslation,
    InReview,
    Approved,
    Published,
  >;
}
