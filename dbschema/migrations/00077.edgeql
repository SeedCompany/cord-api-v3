CREATE MIGRATION m15hyucs7xuol37hmbk5kyuquxwa6a7wrmj722fka3w2pifsfdywsq
    ONTO m1uvexxh35nkdve7dqedttwvikcteavvm4qsknb73iag7v4zrodkwq
{
  ALTER TYPE Budget::Record {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForBudgetRecord;
  };
  ALTER TYPE Budget::Record {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForBudgetRecord;
  };
  ALTER TYPE Budget::Record {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForBudgetRecord
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium))))
          );
  };
  ALTER TYPE Budget::Record {
      CREATE ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForBudgetRecord
          ALLOW UPDATE WRITE, DELETE, INSERT ;
  };
  ALTER TYPE Comments::Aware {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForCommentable;
  };
  ALTER TYPE Comments::Aware {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForCommentable
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE Comments::Aware {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForCommentable
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE Comments::Comment {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForComment;
  };
  ALTER TYPE Comments::Comment {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForComment
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles)) OR (.isOwner ?? false))
          );
  };
  ALTER TYPE Comments::Comment {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForComment
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE Comments::Thread {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForCommentThread;
  };
  ALTER TYPE Comments::Thread {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForCommentThread
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles)) OR (.isOwner ?? false))
          );
  };
  ALTER TYPE Comments::Thread {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForCommentThread
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE Engagement::Ceremony {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForCeremony;
  };
  ALTER TYPE Engagement::Ceremony {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForCeremony;
  };
  ALTER TYPE Engagement::Ceremony {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForCeremony
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE Engagement::Ceremony {
      CREATE ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForCeremony
          ALLOW UPDATE WRITE, DELETE, INSERT ;
  };
  ALTER TYPE Ethnologue::Language {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForEthnologueLanguage;
  };
  ALTER TYPE Ethnologue::Language {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEthnologueLanguage
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((((EXISTS ((<default::Role>{'Administrator', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.sensitivity <= default::Sensitivity.Medium))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT givenRoles)) AND .isMember)) OR ((default::Role.Fundraising IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Marketing', 'Fundraising', 'ExperienceOperations'} INTERSECT givenRoles)) AND (.sensitivity <= default::Sensitivity.Low)))
          );
  };
  ALTER TYPE Ethnologue::Language {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForEthnologueLanguage
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE File::Node {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForFileNode;
  };
  ALTER TYPE File::Node {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFileNode
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE File::Node {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFileNode
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Media {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForMedia;
  };
  ALTER TYPE default::Media {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForMedia
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE default::Media {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForMedia
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE Mixin::Postable {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForPostable;
  };
  ALTER TYPE Mixin::Postable {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPostable
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE Mixin::Postable {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPostable
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE ProgressReport::CommunityStory {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProgressReportCommunityStory;
  };
  ALTER TYPE ProgressReport::CommunityStory {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportCommunityStory
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE ProgressReport::CommunityStory {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportCommunityStory
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE ProgressReport::Highlight {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProgressReportHighlight;
  };
  ALTER TYPE ProgressReport::Highlight {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportHighlight
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE ProgressReport::Highlight {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportHighlight
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE ProgressReport::Media {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProgressReportMedia;
  };
  ALTER TYPE ProgressReport::Media {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportMedia
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((((((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT givenRoles)) AND .isMember)) OR (((default::Role.FieldPartner IN givenRoles) AND .isMember) AND (<std::str>.variant = 'draft'))) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND (((.isMember AND (<std::str>.variant IN {'draft', 'translated', 'fpm'})) OR ((.sensitivity <= default::Sensitivity.Low) AND (<std::str>.variant IN {'fpm', 'published'}))) OR .isMember))) OR ((default::Role.Translator IN givenRoles) AND ((.isMember AND (<std::str>.variant = 'translated')) OR .isMember))) OR (.isOwner ?? false))
          );
  };
  ALTER TYPE ProgressReport::Media {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportMedia
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE ProgressReport::TeamNews {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProgressReportTeamNews;
  };
  ALTER TYPE ProgressReport::TeamNews {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportTeamNews
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE ProgressReport::TeamNews {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportTeamNews
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE ProgressReport::VarianceExplanation {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProgressReportVarianceExplanation;
  };
  ALTER TYPE ProgressReport::VarianceExplanation {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportVarianceExplanation
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE ProgressReport::VarianceExplanation {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportVarianceExplanation
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE ProgressReport::WorkflowEvent {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProgressReportWorkflowEvent;
  };
  ALTER TYPE ProgressReport::WorkflowEvent {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportWorkflowEvent
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE ProgressReport::WorkflowEvent {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportWorkflowEvent
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE ProgressReport::ProductProgress::Step {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForStepProgress;
  };
  ALTER TYPE ProgressReport::ProductProgress::Step {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForStepProgress
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((((EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'StaffMember'} INTERSECT givenRoles)) OR (((default::Role.FieldPartner IN givenRoles) AND .isMember) AND (<std::str>.variant = 'partner'))) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember) AND (<std::str>.variant IN {'official', 'partner'}))) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE ProgressReport::ProductProgress::Step {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForStepProgress
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE Project::Member {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProjectMember;
  };
  ALTER TYPE Project::Member {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProjectMember
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE Project::Member {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProjectMember
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE User::Education {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForEducation;
  };
  ALTER TYPE User::Education {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEducation
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE User::Education {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForEducation
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE User::Unavailability {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForUnavailability;
  };
  ALTER TYPE User::Unavailability {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForUnavailability
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Intern', 'Mentor'} INTERSECT givenRoles)) AND EXISTS ({'Stubbed .isMember for User/Unavailability'})))
          );
  };
  ALTER TYPE User::Unavailability {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForUnavailability
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Budget {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForBudget;
  };
  ALTER TYPE default::Budget {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForBudget;
  };
  ALTER TYPE default::Budget {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForBudget
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium))))
          );
  };
  ALTER TYPE default::Budget {
      CREATE ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForBudget
          ALLOW UPDATE WRITE, DELETE, INSERT ;
  };
  ALTER TYPE default::Directory {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForDirectory;
  };
  ALTER TYPE default::Directory {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForDirectory
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE default::Engagement {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForEngagement;
  };
  ALTER TYPE default::Engagement {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEngagement
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE default::Engagement {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForEngagement
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Producible {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProducible;
  };
  ALTER TYPE default::Producible {
      CREATE ACCESS POLICY CanSelectUpdateReadUpdateWriteGeneratedFromAppPoliciesForProducible
          ALLOW SELECT, UPDATE ;
  };
  ALTER TYPE default::FieldRegion {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForFieldRegion;
  };
  ALTER TYPE default::FieldRegion {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFieldRegion
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE default::FieldRegion {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFieldRegion
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::FieldZone {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForFieldZone;
  };
  ALTER TYPE default::FieldZone {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFieldZone
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE default::FieldZone {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFieldZone
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::PeriodicReport {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForPeriodicReport;
  };
  ALTER TYPE default::PeriodicReport {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForPeriodicReport;
  };
  ALTER TYPE default::PeriodicReport {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPeriodicReport
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
              ,
              isMember := 
                  (.container[IS Project::ContextAware].isMember ?? false)
              ,
              sensitivity := 
                  (.container[IS Project::ContextAware].sensitivity ?? default::Sensitivity.High)
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'ConsultantManager', 'Marketing', 'Fundraising', 'ExperienceOperations'} INTERSECT givenRoles)) AND (isMember OR (sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor', 'Translator'} INTERSECT givenRoles)) AND isMember))
          );
  };
  ALTER TYPE default::PeriodicReport {
      CREATE ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForPeriodicReport
          ALLOW UPDATE WRITE, DELETE, INSERT ;
  };
  ALTER TYPE default::FundingAccount {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForFundingAccount;
  };
  ALTER TYPE default::FundingAccount {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFundingAccount
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE default::FundingAccount {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFundingAccount
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Project {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProject;
  };
  ALTER TYPE default::Project {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProject
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Fundraising', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'RegionalDirector', 'FieldOperationsDirector', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE default::Project {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProject
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Language {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForLanguage;
  };
  ALTER TYPE default::Language {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForLanguage
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Fundraising', 'Marketing', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE default::Language {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForLanguage
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::LanguageEngagement {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForLanguageEngagement;
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForLanguageEngagement
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.ConsultantManager IN givenRoles)
          );
  };
  ALTER TYPE default::Location {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForLocation;
  };
  ALTER TYPE default::Location {
      CREATE ACCESS POLICY CanSelectUpdateReadUpdateWriteGeneratedFromAppPoliciesForLocation
          ALLOW SELECT, UPDATE ;
  };
  ALTER TYPE default::NarrativeReport {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForNarrativeReport;
  };
  ALTER TYPE default::NarrativeReport {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForNarrativeReport
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
              ,
              isMember := 
                  (.container[IS Project::ContextAware].isMember ?? false)
          SELECT
              (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT givenRoles)) AND isMember)
          );
  };
  ALTER TYPE default::Organization {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForOrganization;
  };
  ALTER TYPE default::Organization {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForOrganization
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT givenRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ExperienceOperations', 'Fundraising'} INTERSECT givenRoles)) AND (.sensitivity <= default::Sensitivity.Medium))) OR ((default::Role.Marketing IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Low))))
          );
  };
  ALTER TYPE default::Organization {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForOrganization
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Partner {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForPartner;
  };
  ALTER TYPE default::Partner {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPartner
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT givenRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ExperienceOperations', 'Fundraising'} INTERSECT givenRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR ((default::Role.Marketing IN givenRoles) AND ((.isMember AND (.sensitivity <= default::Sensitivity.Medium)) OR (.sensitivity <= default::Sensitivity.Low)))) OR ((default::Role.StaffMember IN givenRoles) AND (.sensitivity <= default::Sensitivity.Low)))
          );
  };
  ALTER TYPE default::Partner {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPartner
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Partnership {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForPartnership;
  };
  ALTER TYPE default::Partnership {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPartnership
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT givenRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR ((default::Role.StaffMember IN givenRoles) AND (.sensitivity <= default::Sensitivity.Low)))
          );
  };
  ALTER TYPE default::Partnership {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPartnership
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Post {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForPost;
  };
  ALTER TYPE default::Post {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPost
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles)) OR (.isOwner ?? false))
          );
  };
  ALTER TYPE default::Post {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPost
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::ProgressReport {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProgressReport;
  };
  ALTER TYPE default::ProgressReport {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReport
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember)
          );
  };
  ALTER TYPE default::User {
      DROP ACCESS POLICY CanSelectGeneratedFromAppPoliciesForUser;
  };
  ALTER TYPE default::User {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForUser
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles)) OR (.isOwner ?? false)) OR (EXISTS ((<default::Role>{'Intern', 'Mentor'} INTERSECT givenRoles)) AND EXISTS ({'Stubbed .isMember for User/Unavailability'})))
          );
  };
  ALTER TYPE default::User {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForUser
          ALLOW UPDATE WRITE ;
  };
};
