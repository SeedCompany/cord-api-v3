module default {
  type ProgressReport extending PeriodicReport, Engagement::Child {
    overloaded container: LanguageEngagement;
    overloaded engagement: LanguageEngagement;

    status := .latestEvent.status ?? ProgressReport::Status.NotStarted;
    latestEvent := (select .workflowEvents order by .at desc limit 1);
    workflowEvents := .<report[is ProgressReport::WorkflowEvent];

    single varianceExplanation := .<report[is ProgressReport::VarianceExplanation];

    access policy CanReadGeneratedFromAppPoliciesForProgressReport
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Leadership', 'StaffMember'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'Consultant', 'FieldPartner', 'Intern', 'Mentor', 'ProjectManager', 'RegionalDirector', 'Translator'} intersect default::currentUser.roles) and .isMember)
        or (default::Role.ConsultantManager in default::currentUser.roles and (.isMember or .sensitivity <= default::Sensitivity.Medium))
        or (exists (<default::Role>{'Fundraising', 'Marketing'} intersect default::currentUser.roles) and (.isMember or .sensitivity <= default::Sensitivity.Medium))
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

    access policy CanReadGeneratedFromAppPoliciesForProgressReportTeamNews
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'Consultant', 'FieldPartner', 'Translator'} intersect default::currentUser.roles) and .isMember)
        or (default::Role.ConsultantManager in default::currentUser.roles and (.isMember or .sensitivity <= default::Sensitivity.Medium))
    );
    access policy CanCreateGeneratedFromAppPoliciesForProgressReportTeamNews
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
        or (exists (<default::Role>{'FieldOperationsDirector', 'FieldPartner', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles) and .isMember)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForProgressReportTeamNews
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }
  type CommunityStory extending ProgressReport::Child, Prompt::PromptVariantResponse {
    overloaded container: default::ProgressReport;

    access policy CanReadGeneratedFromAppPoliciesForProgressReportCommunityStory
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'Consultant', 'FieldPartner', 'Translator'} intersect default::currentUser.roles) and .isMember)
        or (default::Role.ConsultantManager in default::currentUser.roles and (.isMember or .sensitivity <= default::Sensitivity.Medium))
    );
    access policy CanCreateGeneratedFromAppPoliciesForProgressReportCommunityStory
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
        or (exists (<default::Role>{'FieldOperationsDirector', 'FieldPartner', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles) and .isMember)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForProgressReportCommunityStory
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }
  type Highlight extending ProgressReport::Child, Prompt::PromptVariantResponse {
    overloaded container: default::ProgressReport;

    access policy CanReadGeneratedFromAppPoliciesForProgressReportHighlight
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'Consultant', 'FieldPartner', 'Translator'} intersect default::currentUser.roles) and .isMember)
        or (default::Role.ConsultantManager in default::currentUser.roles and (.isMember or .sensitivity <= default::Sensitivity.Medium))
    );
    access policy CanCreateGeneratedFromAppPoliciesForProgressReportHighlight
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
        or (exists (<default::Role>{'FieldOperationsDirector', 'FieldPartner', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles) and .isMember)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForProgressReportHighlight
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }

  type VarianceExplanation extending ProgressReport::Child {
    overloaded report {
      constraint exclusive;
    };

    multi reasons: str;

    comments: default::RichText;

    access policy CanReadGeneratedFromAppPoliciesForProgressReportVarianceExplanation
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
        or (default::Role.Consultant in default::currentUser.roles and .isMember)
        or (default::Role.ConsultantManager in default::currentUser.roles and (.isMember or .sensitivity <= default::Sensitivity.Medium))
    );
    access policy CanCreateGeneratedFromAppPoliciesForProgressReportVarianceExplanation
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForProgressReportVarianceExplanation
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }

  module Media {
    type VariantGroup;
  }
  type Media extending ProgressReport::Child, Mixin::Owned {
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

    access policy CanReadGeneratedFromAppPoliciesForProgressReportMedia
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Leadership', 'Marketing'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'BetaTester', 'BibleTranslationLiaison', 'Controller', 'ExperienceOperations', 'FinancialAnalyst', 'Fundraising', 'Intern', 'LeadFinancialAnalyst', 'Liaison', 'Mentor', 'RegionalCommunicationsCoordinator', 'StaffMember'} intersect default::currentUser.roles) and (.isOwner ?? false))
        or (default::Role.Consultant in default::currentUser.roles and (.isMember or (.isOwner ?? false)))
        or (default::Role.ConsultantManager in default::currentUser.roles and (.isMember or .sensitivity <= default::Sensitivity.Medium or (.isOwner ?? false)))
        or (default::Role.FieldOperationsDirector in default::currentUser.roles and ((.isOwner ?? false) or (.isMember and <str>.variant in {'draft', 'translated', 'fpm'}) or (.sensitivity <= default::Sensitivity.Low and <str>.variant in {'fpm', 'published'}) or .isMember))
        or (default::Role.FieldPartner in default::currentUser.roles and ((.isMember and <str>.variant = 'draft') or (.isOwner ?? false)))
        or (default::Role.ProjectManager in default::currentUser.roles and ((.isOwner ?? false) or (.isMember and <str>.variant in {'draft', 'translated', 'fpm'}) or (.sensitivity <= default::Sensitivity.Low and <str>.variant in {'fpm', 'published'}) or .isMember))
        or (default::Role.RegionalDirector in default::currentUser.roles and ((.isOwner ?? false) or (.isMember and <str>.variant in {'draft', 'translated', 'fpm'}) or (.sensitivity <= default::Sensitivity.Low and <str>.variant in {'fpm', 'published'}) or .isMember))
        or (default::Role.Translator in default::currentUser.roles and ((.isOwner ?? false) or (.isMember and <str>.variant = 'translated') or .isMember))
    );
    access policy CanCreateGeneratedFromAppPoliciesForProgressReportMedia
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
        or (exists (<default::Role>{'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles) and (.isMember and <str>.variant in {'draft', 'translated', 'fpm'}))
        or (default::Role.FieldPartner in default::currentUser.roles and (.isMember and <str>.variant = 'draft'))
        or (default::Role.Marketing in default::currentUser.roles and <str>.variant = 'published')
        or (default::Role.Translator in default::currentUser.roles and (.isMember and <str>.variant = 'translated'))
    );
    access policy CanDeleteGeneratedFromAppPoliciesForProgressReportMedia
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
        or (exists (<default::Role>{'BetaTester', 'BibleTranslationLiaison', 'Consultant', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'Fundraising', 'Intern', 'LeadFinancialAnalyst', 'Leadership', 'Liaison', 'Marketing', 'Mentor', 'ProjectManager', 'RegionalCommunicationsCoordinator', 'RegionalDirector', 'StaffMember', 'Translator'} intersect default::currentUser.roles) and (.isOwner ?? false))
    );
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

    access policy CanReadGeneratedFromAppPoliciesForProgressReportWorkflowEvent
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
    );
    access policy CanCreateGeneratedFromAppPoliciesForProgressReportWorkflowEvent
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
        or (exists (<default::Role>{'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles) and ((.transitionId in {'5da76b5163', 'cb18f58cbf', '651d2a4dcc', '580377ea2b', '0d854e832e', 'e14c52346b', '2b137bcd66', 'a0c0c48a8c', 'e3e11c86b9'}) ?? false))
        or (default::Role.FieldPartner in default::currentUser.roles and ((.transitionId in {'5da76b5163', 'cb18f58cbf', '651d2a4dcc', 'e14c52346b'}) ?? false))
        or (default::Role.Marketing in default::currentUser.roles and ((.transitionId = '2d88e3cd6e') ?? false))
        or (default::Role.Translator in default::currentUser.roles and ((.transitionId in {'580377ea2b', '0d854e832e'}) ?? false))
    );
    access policy CanDeleteGeneratedFromAppPoliciesForProgressReportWorkflowEvent
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
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
