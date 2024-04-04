CREATE MIGRATION m1dxwenx3me4w6ho2egcvovzzyqpcbibk4y2iro7ybed3i3v5utcyq
    ONTO m1uqme6noxofu7imqwvszj4ljpybefs7jgamutiv35ttbes5nwd3oq
{
  ALTER TYPE Budget::Record {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForBudgetRecord
          ALLOW DELETE, INSERT ;
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForBudgetRecord
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium))))
          );
  };
  ALTER TYPE Project::ContextAware {
      CREATE INDEX ON (.projectContext);
  };
  ALTER TYPE Comments::Aware {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForCommentable
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForCommentable
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE Comments::Comment {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForComment
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR (.isOwner ?? false))
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForComment
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForComment
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles)) OR (.isOwner ?? false))
          );
  };
  ALTER TYPE Comments::Thread {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForCommentThread
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR (.isOwner ?? false))
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForCommentThread
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForCommentThread
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles)) OR (.isOwner ?? false))
          );
  };
  ALTER TYPE Engagement::Ceremony {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForCeremony
          ALLOW DELETE, INSERT ;
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForCeremony
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE ProgressReport::CommunityStory {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportCommunityStory
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportCommunityStory
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProgressReportCommunityStory
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE ProgressReport::Highlight {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportHighlight
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportHighlight
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProgressReportHighlight
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE ProgressReport::Media {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportMedia
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR (.isOwner ?? false))
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportMedia
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (((((default::Role.Administrator IN givenRoles) OR (((default::Role.FieldPartner IN givenRoles) AND .isMember) AND (<std::str>.variant = 'draft'))) OR ((default::Role.Marketing IN givenRoles) AND (<std::str>.variant = 'published'))) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember) AND (<std::str>.variant IN {'draft', 'translated', 'fpm'}))) OR (((default::Role.Translator IN givenRoles) AND .isMember) AND (<std::str>.variant = 'translated')))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProgressReportMedia
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((((((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT givenRoles)) AND .isMember)) OR (((default::Role.FieldPartner IN givenRoles) AND .isMember) AND (<std::str>.variant = 'draft'))) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND (((.isMember AND (<std::str>.variant IN {'draft', 'translated', 'fpm'})) OR ((.sensitivity <= default::Sensitivity.Low) AND (<std::str>.variant IN {'fpm', 'published'}))) OR .isMember))) OR ((default::Role.Translator IN givenRoles) AND ((.isMember AND (<std::str>.variant = 'translated')) OR .isMember))) OR (.isOwner ?? false))
          );
  };
  ALTER TYPE ProgressReport::TeamNews {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportTeamNews
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportTeamNews
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProgressReportTeamNews
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE ProgressReport::VarianceExplanation {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForProgressReportVarianceExplanation
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProgressReportVarianceExplanation
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE Ethnologue::Language {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForEthnologueLanguage
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForEthnologueLanguage
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((((EXISTS ((<default::Role>{'Administrator', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.sensitivity <= default::Sensitivity.Medium))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT givenRoles)) AND .isMember)) OR ((default::Role.Fundraising IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Marketing', 'Fundraising', 'ExperienceOperations'} INTERSECT givenRoles)) AND (.sensitivity <= default::Sensitivity.Low)))
          );
  };
  ALTER TYPE File::Node {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFileNode
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForFileNode
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE default::Directory {
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForDirectory
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE default::Media {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForMedia
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForMedia
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE Mixin::Postable {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForPostable
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForPostable
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE default::Project {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProject
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProject
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProject
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Fundraising', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'RegionalDirector', 'FieldOperationsDirector', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE default::Language {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForLanguage
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForLanguage
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Fundraising', 'Marketing', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE default::Partner {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForPartner
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Controller'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForPartner
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForPartner
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT givenRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ExperienceOperations', 'Fundraising'} INTERSECT givenRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR ((default::Role.Marketing IN givenRoles) AND ((.isMember AND (.sensitivity <= default::Sensitivity.Medium)) OR (.sensitivity <= default::Sensitivity.Low)))) OR ((default::Role.StaffMember IN givenRoles) AND (.sensitivity <= default::Sensitivity.Low)))
          );
  };
  ALTER TYPE ProgressReport::WorkflowEvent {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportWorkflowEvent
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportWorkflowEvent
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (((((default::Role.Administrator IN givenRoles) OR ((default::Role.FieldPartner IN givenRoles) AND ((.transitionId IN {'5da76b5163', 'cb18f58cbf', '651d2a4dcc', 'e14c52346b'}) ?? false))) OR ((default::Role.Marketing IN givenRoles) AND ((.transitionId = '2d88e3cd6e') ?? false))) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND ((.transitionId IN {'5da76b5163', 'cb18f58cbf', '651d2a4dcc', '580377ea2b', '0d854e832e', 'e14c52346b', '2b137bcd66', 'a0c0c48a8c', 'e3e11c86b9'}) ?? false))) OR ((default::Role.Translator IN givenRoles) AND ((.transitionId IN {'580377ea2b', '0d854e832e'}) ?? false)))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProgressReportWorkflowEvent
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE ProgressReport::ProductProgress::Step {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForStepProgress
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForStepProgress
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((((EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'StaffMember'} INTERSECT givenRoles)) OR (((default::Role.FieldPartner IN givenRoles) AND .isMember) AND (<std::str>.variant = 'partner'))) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember) AND (<std::str>.variant IN {'official', 'partner'}))) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE Project::Member {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForProjectMember
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProjectMember
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE default::Budget {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForBudget
          ALLOW DELETE, INSERT ;
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForBudget
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium))))
          );
  };
  ALTER TYPE default::Engagement {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForEngagement
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles)) AND .isMember) AND (<std::str>.status = 'InDevelopment')))
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForEngagement
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles)) AND .isMember))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForEngagement
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForLanguageEngagement
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.ConsultantManager IN givenRoles)
          );
  };
  ALTER TYPE default::Partnership {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForPartnership
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium))))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForPartnership
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT givenRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR ((default::Role.StaffMember IN givenRoles) AND (.sensitivity <= default::Sensitivity.Low)))
          );
  };
  ALTER TYPE default::Organization {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForOrganization
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Controller'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForOrganization
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForOrganization
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT givenRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ExperienceOperations', 'Fundraising'} INTERSECT givenRoles)) AND (.sensitivity <= default::Sensitivity.Medium))) OR ((default::Role.Marketing IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Low))))
          );
  };
  ALTER TYPE User::Education {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForEducation
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForEducation
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForEducation
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE User::Unavailability {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForUnavailability
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForUnavailability
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForUnavailability
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Intern', 'Mentor'} INTERSECT givenRoles)) AND EXISTS ({'Stubbed .isMember for User/Unavailability'})))
          );
  };
  ALTER TYPE default::Producible {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProducible
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProducible
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProducible
          ALLOW SELECT ;
  };
  ALTER TYPE default::FieldRegion {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFieldRegion
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForFieldRegion
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE default::FieldZone {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFieldZone
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForFieldZone
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE default::PeriodicReport {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForPeriodicReport
          ALLOW DELETE, INSERT ;
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForPeriodicReport
          ALLOW SELECT USING (WITH
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
  ALTER TYPE default::FundingAccount {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFundingAccount
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForFundingAccount
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles))
          );
  };
  ALTER TYPE default::Location {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForLocation
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForLocation
          ALLOW SELECT ;
  };
  ALTER TYPE default::NarrativeReport {
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForNarrativeReport
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
              ,
              isMember := 
                  (.container[IS Project::ContextAware].isMember ?? false)
          SELECT
              (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT givenRoles)) AND isMember)
          );
  };
  ALTER TYPE default::ProgressReport {
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForProgressReport
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember)
          );
  };
  ALTER TYPE default::Post {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForPost
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR (.isOwner ?? false))
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForPost
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForPost
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles)) OR (.isOwner ?? false))
          );
  };
  ALTER TYPE default::User {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForUser
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForUser
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanSelectGeneratedFromAppPoliciesForUser
          ALLOW SELECT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles)) OR (.isOwner ?? false)) OR (EXISTS ((<default::Role>{'Intern', 'Mentor'} INTERSECT givenRoles)) AND EXISTS ({'Stubbed .isMember for User/Unavailability'})))
          );
  };
};
