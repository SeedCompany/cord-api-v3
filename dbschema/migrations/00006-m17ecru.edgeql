CREATE MIGRATION m17ecruskq3k5hphihs23fnzzaf7fjd2obhafu3mvgbefnsn2an5iq
    ONTO m1yeyjrzkznhb2fr4txj432k3nlumdnjwsdyuhinrfmt64je5lwfta
{
  ALTER TYPE default::Resource {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForResource
          ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForResource
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForResource
          ALLOW UPDATE WRITE;
  };
  ALTER TYPE Budget::Record {
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForBudgetRecord USING ((((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium))) OR EXISTS ((<default::Role>{'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles))));
      DROP ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForBudgetRecord;
  };
  ALTER TYPE Comments::Aware {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForCommentable;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForCommentable;
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForCommentable;
  };
  ALTER TYPE Comments::Comment {
      CREATE ACCESS POLICY CanSelectUpdateReadDeleteGeneratedFromAppPoliciesForComment
          ALLOW SELECT, UPDATE READ, DELETE USING (.isCreator);
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForComment;
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForComment;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForComment;
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForComment;
  };
  ALTER TYPE Comments::Thread {
      CREATE ACCESS POLICY CanSelectUpdateReadDeleteGeneratedFromAppPoliciesForCommentThread
          ALLOW SELECT, UPDATE READ, DELETE USING (.isCreator);
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForCommentThread;
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForCommentThread;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForCommentThread;
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForCommentThread;
  };
  ALTER TYPE Engagement::Ceremony {
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForCeremony USING ((EXISTS ((<default::Role>{'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      DROP ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForCeremony;
  };
  ALTER TYPE File::Node {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFileNode;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFileNode;
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFileNode;
  };
  ALTER TYPE ProgressReport::CommunityStory {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportCommunityStory;
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportCommunityStory USING (((default::Role.Marketing IN GLOBAL default::currentRoles) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportCommunityStory USING (((EXISTS ((<default::Role>{'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportCommunityStory;
  };
  ALTER TYPE ProgressReport::Highlight {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportHighlight;
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportHighlight USING (((default::Role.Marketing IN GLOBAL default::currentRoles) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportHighlight USING (((EXISTS ((<default::Role>{'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportHighlight;
  };
  ALTER TYPE ProgressReport::Media {
      ALTER ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportMedia USING (.isCreator);
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportMedia USING (((((((default::Role.FieldPartner IN GLOBAL default::currentRoles) AND .isMember) AND (<std::str>.variant = 'draft')) OR ((default::Role.Marketing IN GLOBAL default::currentRoles) AND (<std::str>.variant = 'published'))) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND (<std::str>.variant IN {'draft', 'translated', 'fpm'}))) OR (((default::Role.Translator IN GLOBAL default::currentRoles) AND .isMember) AND (<std::str>.variant = 'translated'))));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportMedia USING (((((((((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)) OR (((default::Role.FieldPartner IN GLOBAL default::currentRoles) AND .isMember) AND (<std::str>.variant = 'draft'))) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND (((.isMember AND (<std::str>.variant IN {'draft', 'translated', 'fpm'})) OR ((.sensitivity <= default::Sensitivity.Low) AND (<std::str>.variant IN {'fpm', 'published'}))) OR .isMember))) OR ((default::Role.Translator IN GLOBAL default::currentRoles) AND ((.isMember AND (<std::str>.variant = 'translated')) OR .isMember))) OR (default::Role.Marketing IN GLOBAL default::currentRoles)) OR .isCreator));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportMedia;
  };
  ALTER TYPE ProgressReport::TeamNews {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportTeamNews;
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportTeamNews USING (((default::Role.Marketing IN GLOBAL default::currentRoles) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportTeamNews USING (((EXISTS ((<default::Role>{'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportTeamNews;
  };
  ALTER TYPE Project::Member {
      ALTER ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForProjectMember USING ((EXISTS ((<default::Role>{'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProjectMember USING ((EXISTS ((<default::Role>{'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProjectMember;
  };
  ALTER TYPE User::Education {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForEducation;
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForEducation USING (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEducation USING (EXISTS ((<default::Role>{'ConsultantManager', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForEducation;
  };
  ALTER TYPE User::Unavailability {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForUnavailability;
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForUnavailability USING (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForUnavailability USING ((EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Intern', 'Mentor'} INTERSECT GLOBAL default::currentRoles)) AND EXISTS ({'Stubbed .isMember for User/Unavailability'}))));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForUnavailability;
  };
  ALTER TYPE default::Budget {
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForBudget USING ((((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium))) OR EXISTS ((<default::Role>{'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles))));
      DROP ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForBudget;
  };
  ALTER TYPE default::Engagement {
      ALTER ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForEngagement USING (((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND (<std::str>.status = 'InDevelopment')));
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForEngagement USING (((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND (<std::str>.project.status = 'InDevelopment')));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEngagement USING ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForEngagement;
  };
  ALTER TYPE default::Producible {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProducible;
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProducible USING (EXISTS ((<default::Role>{'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles)));
  };
  ALTER TYPE default::Producible {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProducible
          ALLOW SELECT, UPDATE READ;
  };
  ALTER TYPE default::Producible {
      DROP ACCESS POLICY CanSelectUpdateReadUpdateWriteGeneratedFromAppPoliciesForProducible;
  };
  ALTER TYPE default::FieldRegion {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFieldRegion;
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFieldRegion USING (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFieldRegion;
  };
  ALTER TYPE default::FieldZone {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFieldZone;
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFieldZone USING (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFieldZone;
  };
  ALTER TYPE default::PeriodicReport {
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPeriodicReport USING (
        WITH
          isMember := (.container[IS Project::ContextAware].isMember ?? false),
          sensitivity := (.container[IS Project::ContextAware].sensitivity ?? default::Sensitivity.High)
      SELECT
          ((EXISTS ((<default::Role>{'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'ConsultantManager', 'Marketing', 'Fundraising', 'ExperienceOperations'} INTERSECT GLOBAL default::currentRoles)) AND (isMember OR (sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND isMember))
      );
      DROP ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForPeriodicReport;
  };
  ALTER TYPE default::FundingAccount {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFundingAccount;
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFundingAccount USING (EXISTS ((<default::Role>{'ConsultantManager', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFundingAccount;
  };
  ALTER TYPE default::Project {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProject;
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProject USING (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProject USING ((EXISTS ((<default::Role>{'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Fundraising', 'Marketing', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'RegionalDirector', 'FieldOperationsDirector', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProject;
  };
  ALTER TYPE default::Language {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForLanguage;
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForLanguage USING ((EXISTS ((<default::Role>{'ConsultantManager', 'ExperienceOperations', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Fundraising', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForLanguage;
  };
  ALTER TYPE default::Location {
      DROP ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForLocation;
  };
  ALTER TYPE default::Location {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForLocation
          ALLOW SELECT, UPDATE READ;
  };
  ALTER TYPE default::Location {
      DROP ACCESS POLICY CanSelectUpdateReadUpdateWriteGeneratedFromAppPoliciesForLocation;
  };
  ALTER TYPE default::Organization {
      ALTER ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForOrganization USING ((default::Role.Controller IN GLOBAL default::currentRoles));
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForOrganization USING (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForOrganization USING ((((EXISTS ((<default::Role>{'ConsultantManager', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ExperienceOperations', 'Fundraising'} INTERSECT GLOBAL default::currentRoles)) AND (.sensitivity <= default::Sensitivity.Medium))) OR ((default::Role.Marketing IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Low)))));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForOrganization;
  };
  ALTER TYPE default::Partner {
      ALTER ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForPartner USING ((default::Role.Controller IN GLOBAL default::currentRoles));
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForPartner USING (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPartner USING (((((EXISTS ((<default::Role>{'ConsultantManager', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ExperienceOperations', 'Fundraising'} INTERSECT GLOBAL default::currentRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR ((default::Role.Marketing IN GLOBAL default::currentRoles) AND ((.isMember AND (.sensitivity <= default::Sensitivity.Medium)) OR (.sensitivity <= default::Sensitivity.Low)))) OR ((default::Role.StaffMember IN GLOBAL default::currentRoles) AND (.sensitivity <= default::Sensitivity.Low))));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPartner;
  };
  ALTER TYPE default::Partnership {
      ALTER ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForPartnership USING (((EXISTS ((<default::Role>{'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPartnership USING ((((EXISTS ((<default::Role>{'ConsultantManager', 'ExperienceOperations', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR ((default::Role.StaffMember IN GLOBAL default::currentRoles) AND (.sensitivity <= default::Sensitivity.Low))));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPartnership;
  };
  ALTER TYPE default::Post {
      CREATE ACCESS POLICY CanSelectUpdateReadDeleteGeneratedFromAppPoliciesForPost
          ALLOW SELECT, UPDATE READ, DELETE USING (.isCreator);
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForPost;
      DROP ACCESS POLICY CanInsertGeneratedFromAppPoliciesForPost;
      DROP ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPost;
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPost;
  };
  ALTER TYPE default::User {
      DROP ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForUser;
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForUser USING (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForUser USING (((EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (.id ?= GLOBAL default::currentActorId)) OR (EXISTS ((<default::Role>{'Intern', 'Mentor'} INTERSECT GLOBAL default::currentRoles)) AND EXISTS ({'Stubbed .isMember for User/Unavailability'}))));
      DROP ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForUser;
  };
};
