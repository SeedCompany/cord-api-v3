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

  type TeamNews extending ProgressReport::Child, Prompt::PromptVariantResponse {
    overloaded container: default::ProgressReport;
  }
  type CommunityStory extending ProgressReport::Child, Prompt::PromptVariantResponse {
    overloaded container: default::ProgressReport;
  }
  type Highlight extending ProgressReport::Child, Prompt::PromptVariantResponse {
    overloaded container: default::ProgressReport;
  }

  type VarianceExplanation extending ProgressReport::Child {
    overloaded report {
      constraint exclusive;
    };

    multi reasons: str;

    comments: default::RichText;
  }

  module Media {
    type VariantGroup;
  }
  type Media extending ProgressReport::Child {
    required file: default::File;
    required single media := assert_exists(.file.media);

    required variantGroup: ProgressReport::Media::VariantGroup;
    required variant: str;
    constraint exclusive on ((.variantGroup, .variant));
    trigger deleteEmptyVariantGroup after delete for each do (
      delete __old__.variantGroup
      filter not exists (select Media filter .variantGroup = __old__.variantGroup)
    );

    category: str;
  }

  type WorkflowEvent {
    required report: default::ProgressReport {
      readonly := true;
    };
    required who: default::User {
      readonly := true;
      default := global default::currentUser;
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
