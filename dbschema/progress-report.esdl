module default {
  type ProgressReport extending PeriodicReport, Engagement::Child {
    overloaded container: LanguageEngagement;
    overloaded engagement: LanguageEngagement;

    status := .latestEvent.status ?? ProgressReport::Status.NotStarted;
    latestEvent := (select .workflowEvents order by .at desc limit 1);
    workflowEvents := .<report[is ProgressReport::WorkflowEvent];

    single varianceExplanation := .<report[is ProgressReport::VarianceExplanation];

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReport
    allow select, update read using (
      (
        exists (<Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global currentRoles)
        and .isMember
      )
    );
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

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportTeamNews
    allow select, update read using (
      (
        exists (<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
        or (
          default::Role.ConsultantManager in global default::currentRoles
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} intersect global default::currentRoles)
          and .isMember
        )
      )
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForProgressReportTeamNews
    allow update write;

    access policy CanInsertGeneratedFromAppPoliciesForProgressReportTeamNews
    allow insert using (
      (
        default::Role.Administrator in global default::currentRoles
        or (
          exists (<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
          and .isMember
        )
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForProgressReportTeamNews
    allow delete using (
      default::Role.Administrator in global default::currentRoles
    );
  }
  type CommunityStory extending ProgressReport::Child, Prompt::PromptVariantResponse {
    overloaded container: default::ProgressReport;

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportCommunityStory
    allow select, update read using (
      (
        exists (<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
        or (
          default::Role.ConsultantManager in global default::currentRoles
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} intersect global default::currentRoles)
          and .isMember
        )
      )
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForProgressReportCommunityStory
    allow update write;

    access policy CanInsertGeneratedFromAppPoliciesForProgressReportCommunityStory
    allow insert using (
      (
        default::Role.Administrator in global default::currentRoles
        or (
          exists (<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
          and .isMember
        )
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForProgressReportCommunityStory
    allow delete using (
      default::Role.Administrator in global default::currentRoles
    );
  }
  type Highlight extending ProgressReport::Child, Prompt::PromptVariantResponse {
    overloaded container: default::ProgressReport;

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportHighlight
    allow select, update read using (
      (
        exists (<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
        or (
          default::Role.ConsultantManager in global default::currentRoles
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} intersect global default::currentRoles)
          and .isMember
        )
      )
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForProgressReportHighlight
    allow update write;

    access policy CanInsertGeneratedFromAppPoliciesForProgressReportHighlight
    allow insert using (
      (
        default::Role.Administrator in global default::currentRoles
        or (
          exists (<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
          and .isMember
        )
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForProgressReportHighlight
    allow delete using (
      default::Role.Administrator in global default::currentRoles
    );
  }

  type VarianceExplanation extending ProgressReport::Child {
    overloaded report {
      constraint exclusive;
    };

    multi reasons: str;

    comments: default::RichText;

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportVarianceExplanation
    allow select, update read using (
      (
        exists (<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
        or (
          default::Role.ConsultantManager in global default::currentRoles
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect global default::currentRoles)
          and .isMember
        )
      )
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForProgressReportVarianceExplanation
    allow update write;

    access policy CanInsertDeleteGeneratedFromAppPoliciesForProgressReportVarianceExplanation
    allow insert, delete using (
      default::Role.Administrator in global default::currentRoles
    );
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

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportMedia
    allow select, update read using (
      (
        exists (<default::Role>{'Administrator', 'Leadership', 'Marketing'} intersect global default::currentRoles)
        or (
          default::Role.ConsultantManager in global default::currentRoles
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect global default::currentRoles)
          and .isMember
        )
        or (
          default::Role.FieldPartner in global default::currentRoles
          and .isMember
          and <str>.variant = 'draft'
        )
        or (
          exists (<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
          and (
            (
              .isMember
              and <str>.variant in {'draft', 'translated', 'fpm'}
            )
            or (
              .sensitivity <= default::Sensitivity.Low
              and <str>.variant in {'fpm', 'published'}
            )
            or .isMember
          )
        )
        or (
          default::Role.Translator in global default::currentRoles
          and (
            (
              .isMember
              and <str>.variant = 'translated'
            )
            or .isMember
          )
        )
        or .isCreator
      )
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForProgressReportMedia
    allow update write;

    access policy CanInsertGeneratedFromAppPoliciesForProgressReportMedia
    allow insert using (
      (
        default::Role.Administrator in global default::currentRoles
        or (
          default::Role.FieldPartner in global default::currentRoles
          and .isMember
          and <str>.variant = 'draft'
        )
        or (
          default::Role.Marketing in global default::currentRoles
          and <str>.variant = 'published'
        )
        or (
          exists (<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
          and .isMember
          and <str>.variant in {'draft', 'translated', 'fpm'}
        )
        or (
          default::Role.Translator in global default::currentRoles
          and .isMember
          and <str>.variant = 'translated'
        )
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForProgressReportMedia
    allow delete using (
      (
        default::Role.Administrator in global default::currentRoles
        or .isCreator
      )
    );
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

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportWorkflowEvent
    allow select, update read using (
      exists (<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForProgressReportWorkflowEvent
    allow update write;

    access policy CanInsertGeneratedFromAppPoliciesForProgressReportWorkflowEvent
    allow insert using (
      (
        default::Role.Administrator in global default::currentRoles
        or (
          default::Role.FieldPartner in global default::currentRoles
          and ((.transitionId in {'5da76b5163', 'cb18f58cbf', '651d2a4dcc', 'e14c52346b'}) ?? false)
        )
        or (
          default::Role.Marketing in global default::currentRoles
          and ((.transitionId = '2d88e3cd6e') ?? false)
        )
        or (
          exists (<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect global default::currentRoles)
          and ((.transitionId in {'5da76b5163', 'cb18f58cbf', '651d2a4dcc', '580377ea2b', '0d854e832e', 'e14c52346b', '2b137bcd66', 'a0c0c48a8c', 'e3e11c86b9'}) ?? false)
        )
        or (
          default::Role.Translator in global default::currentRoles
          and ((.transitionId in {'580377ea2b', '0d854e832e'}) ?? false)
        )
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForProgressReportWorkflowEvent
    allow delete using (
      default::Role.Administrator in global default::currentRoles
    );
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
