CREATE MIGRATION m1qnmd5rhsnesdz4tlmyqw7nlkg2x24gbsysprcsg2odfhzdoy4cja
    ONTO m17teecxqpduefkkjxf64pokydi5e2ztcip6ayk23fvm6snddjbksa
{
  CREATE MODULE Language IF NOT EXISTS;
  ALTER TYPE default::Resource {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForResource;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForResource;
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForResource;
  };
  ALTER TYPE Budget::Record {
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForBudgetRecord;
  };
  ALTER TYPE Comments::Comment {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForComment;
      DROP ACCESS POLICY CanSelectUpdateReadInsertGeneratedFromAppPoliciesForComment;
  };
  ALTER TYPE Comments::Thread {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForCommentThread;
      DROP ACCESS POLICY CanSelectUpdateReadInsertGeneratedFromAppPoliciesForCommentThread;
  };
  ALTER TYPE Engagement::Ceremony {
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForCeremony;
  };
  ALTER TYPE Ethnologue::Language {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForEthnologueLanguage;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEthnologueLanguage;
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForEthnologueLanguage;
  };
  ALTER TYPE default::Media {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForMedia;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForMedia;
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForMedia;
  };
  ALTER TYPE Mixin::Postable {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForPostable;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPostable;
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPostable;
  };
  ALTER TYPE ProgressReport::CommunityStory {
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportCommunityStory;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportCommunityStory;
  };
  ALTER TYPE ProgressReport::Highlight {
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportHighlight;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportHighlight;
  };
  ALTER TYPE ProgressReport::Media {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportMedia;
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportMedia;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportMedia;
  };
  ALTER TYPE ProgressReport::TeamNews {
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportTeamNews;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportTeamNews;
  };
  ALTER TYPE ProgressReport::VarianceExplanation {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForProgressReportVarianceExplanation;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportVarianceExplanation;
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportVarianceExplanation;
  };
  ALTER TYPE ProgressReport::WorkflowEvent {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportWorkflowEvent;
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportWorkflowEvent;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportWorkflowEvent;
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportWorkflowEvent;
  };
  ALTER TYPE ProgressReport::ProductProgress::Step {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForStepProgress;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForStepProgress;
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForStepProgress;
  };
  ALTER TYPE Project::FinancialApprover {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFinancialApprover;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFinancialApprover;
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFinancialApprover;
  };
  ALTER TYPE Project::Member {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForProjectMember;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProjectMember;
  };
  ALTER TYPE Project::WorkflowEvent {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProjectWorkflowEvent;
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProjectWorkflowEvent;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProjectWorkflowEvent;
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProjectWorkflowEvent;
  };
  ALTER TYPE User::Education {
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForEducation;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEducation;
  };
  ALTER TYPE User::Unavailability {
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForUnavailability;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForUnavailability;
  };
  ALTER TYPE default::Budget {
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForBudget;
  };
  ALTER TYPE default::Directory {
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForDirectory;
  };
  ALTER TYPE default::Engagement {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForEngagement;
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForEngagement;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEngagement;
  };
  ALTER TYPE default::Producible {
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProducible;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProducible;
  };
  ALTER TYPE default::FieldRegion {
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFieldRegion;
  };
  ALTER TYPE default::FieldZone {
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFieldZone;
  };
  ALTER TYPE default::PeriodicReport {
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPeriodicReport;
  };
  ALTER TYPE default::FundingAccount {
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFundingAccount;
  };
  ALTER TYPE default::Project {
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProject;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProject;
  };
  ALTER TYPE default::Language {
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForLanguage;
  };
  ALTER TYPE default::LanguageEngagement {
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForLanguageEngagement;
  };
  CREATE SCALAR TYPE Language::Milestone EXTENDING enum<None, OldTestament, NewTestament, FullBible>;
  ALTER TYPE default::LanguageEngagement {
      CREATE PROPERTY milestoneReached: Language::Milestone {
          SET default := (Language::Milestone.None);
      };
  };
  ALTER TYPE default::Location {
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForLocation;
  };
  ALTER TYPE default::NarrativeReport {
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForNarrativeReport;
  };
  ALTER TYPE default::Organization {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForOrganization;
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForOrganization;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForOrganization;
  };
  ALTER TYPE default::Partner {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForPartner;
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForPartner;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPartner;
  };
  ALTER TYPE default::Partnership {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForPartnership;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPartnership;
  };
  ALTER TYPE default::Post {
      DROP ACCESS POLICY CanSelectUpdateReadDeleteGeneratedFromAppPoliciesForPost;
  };
  ALTER TYPE default::ProgressReport {
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReport;
  };
  ALTER TYPE default::User {
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForUser;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForUser;
  };
};
