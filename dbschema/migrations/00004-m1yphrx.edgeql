CREATE MIGRATION m1yphrx7buk7mltbmsuabovma34ukfn7dkllc3pfggljlkadasw2gq
    ONTO m1zasaruu7gg245gjtxbbvqt5t4mh5c2zf5qvq5bvyihhw37uns3ta
{
  ALTER TYPE Budget::Record {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForBudgetRecord
          ALLOW SELECT, UPDATE READ USING ((EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles)) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))));
      CREATE ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForBudgetRecord
          ALLOW UPDATE WRITE, DELETE, INSERT ;
  };
  ALTER TYPE Comments::Aware {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForCommentable
          ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForCommentable
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForCommentable
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE Comments::Comment {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForComment
          ALLOW DELETE USING (((default::Role.Administrator IN GLOBAL default::currentRoles) OR .isCreator));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForComment
          ALLOW INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForComment
          ALLOW SELECT, UPDATE READ USING ((EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT GLOBAL default::currentRoles)) OR .isCreator));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForComment
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE Comments::Thread {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForCommentThread
          ALLOW DELETE USING (((default::Role.Administrator IN GLOBAL default::currentRoles) OR .isCreator));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForCommentThread
          ALLOW INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForCommentThread
          ALLOW SELECT, UPDATE READ USING ((EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT GLOBAL default::currentRoles)) OR .isCreator));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForCommentThread
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE Engagement::Ceremony {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForCeremony
          ALLOW SELECT, UPDATE READ USING ((EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      CREATE ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForCeremony
          ALLOW UPDATE WRITE, DELETE, INSERT ;
  };
  ALTER TYPE Ethnologue::Language {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForEthnologueLanguage
          ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEthnologueLanguage
          ALLOW SELECT, UPDATE READ USING (((((EXISTS ((<default::Role>{'Administrator', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.sensitivity <= default::Sensitivity.Medium))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)) OR ((default::Role.Fundraising IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Marketing', 'Fundraising', 'ExperienceOperations'} INTERSECT GLOBAL default::currentRoles)) AND (.sensitivity <= default::Sensitivity.Low))));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForEthnologueLanguage
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE File::Node {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFileNode
          ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFileNode
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFileNode
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Directory {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForDirectory
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)));
  };
  ALTER TYPE default::Media {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForMedia
          ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForMedia
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForMedia
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE Mixin::Postable {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForPostable
          ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPostable
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPostable
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Project {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProject
          ALLOW DELETE USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProject
          ALLOW INSERT USING (EXISTS ((<default::Role>{'Administrator', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProject
          ALLOW SELECT, UPDATE READ USING ((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Fundraising', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'RegionalDirector', 'FieldOperationsDirector', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProject
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Language {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForLanguage
          ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForLanguage
          ALLOW SELECT, UPDATE READ USING ((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Fundraising', 'Marketing', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForLanguage
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Partner {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForPartner
          ALLOW DELETE USING (EXISTS ((<default::Role>{'Administrator', 'Controller'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForPartner
          ALLOW INSERT USING (EXISTS ((<default::Role>{'Administrator', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPartner
          ALLOW SELECT, UPDATE READ USING (((((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ExperienceOperations', 'Fundraising'} INTERSECT GLOBAL default::currentRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR ((default::Role.Marketing IN GLOBAL default::currentRoles) AND ((.isMember AND (.sensitivity <= default::Sensitivity.Medium)) OR (.sensitivity <= default::Sensitivity.Low)))) OR ((default::Role.StaffMember IN GLOBAL default::currentRoles) AND (.sensitivity <= default::Sensitivity.Low))));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPartner
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE ProgressReport::CommunityStory {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportCommunityStory
          ALLOW DELETE USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportCommunityStory
          ALLOW INSERT USING ((EXISTS ((<default::Role>{'Administrator', 'Marketing'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportCommunityStory
          ALLOW SELECT, UPDATE READ USING (((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportCommunityStory
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE ProgressReport::Highlight {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportHighlight
          ALLOW DELETE USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportHighlight
          ALLOW INSERT USING ((EXISTS ((<default::Role>{'Administrator', 'Marketing'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportHighlight
          ALLOW SELECT, UPDATE READ USING (((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportHighlight
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE ProgressReport::Media {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportMedia
          ALLOW DELETE USING (((default::Role.Administrator IN GLOBAL default::currentRoles) OR .isCreator));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportMedia
          ALLOW INSERT USING ((((((default::Role.Administrator IN GLOBAL default::currentRoles) OR (((default::Role.FieldPartner IN GLOBAL default::currentRoles) AND .isMember) AND (<std::str>.variant = 'draft'))) OR ((default::Role.Marketing IN GLOBAL default::currentRoles) AND (<std::str>.variant = 'published'))) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND (<std::str>.variant IN {'draft', 'translated', 'fpm'}))) OR (((default::Role.Translator IN GLOBAL default::currentRoles) AND .isMember) AND (<std::str>.variant = 'translated'))));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportMedia
          ALLOW SELECT, UPDATE READ USING (((((((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing'} INTERSECT GLOBAL default::currentRoles)) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)) OR (((default::Role.FieldPartner IN GLOBAL default::currentRoles) AND .isMember) AND (<std::str>.variant = 'draft'))) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND (((.isMember AND (<std::str>.variant IN {'draft', 'translated', 'fpm'})) OR ((.sensitivity <= default::Sensitivity.Low) AND (<std::str>.variant IN {'fpm', 'published'}))) OR .isMember))) OR ((default::Role.Translator IN GLOBAL default::currentRoles) AND ((.isMember AND (<std::str>.variant = 'translated')) OR .isMember))) OR .isCreator));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportMedia
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE ProgressReport::TeamNews {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportTeamNews
          ALLOW DELETE USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportTeamNews
          ALLOW INSERT USING ((EXISTS ((<default::Role>{'Administrator', 'Marketing'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportTeamNews
          ALLOW SELECT, UPDATE READ USING (((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportTeamNews
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE ProgressReport::VarianceExplanation {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForProgressReportVarianceExplanation
          ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportVarianceExplanation
          ALLOW SELECT, UPDATE READ USING (((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportVarianceExplanation
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE ProgressReport::WorkflowEvent {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportWorkflowEvent
          ALLOW DELETE USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportWorkflowEvent
          ALLOW INSERT USING ((((((default::Role.Administrator IN GLOBAL default::currentRoles) OR ((default::Role.FieldPartner IN GLOBAL default::currentRoles) AND ((.transitionId IN {'5da76b5163', 'cb18f58cbf', '651d2a4dcc', 'e14c52346b'}) ?? false))) OR ((default::Role.Marketing IN GLOBAL default::currentRoles) AND ((.transitionId = '2d88e3cd6e') ?? false))) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND ((.transitionId IN {'5da76b5163', 'cb18f58cbf', '651d2a4dcc', '580377ea2b', '0d854e832e', 'e14c52346b', '2b137bcd66', 'a0c0c48a8c', 'e3e11c86b9'}) ?? false))) OR ((default::Role.Translator IN GLOBAL default::currentRoles) AND ((.transitionId IN {'580377ea2b', '0d854e832e'}) ?? false))));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportWorkflowEvent
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportWorkflowEvent
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE ProgressReport::ProductProgress::Step {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForStepProgress
          ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForStepProgress
          ALLOW SELECT, UPDATE READ USING (((((EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (((default::Role.FieldPartner IN GLOBAL default::currentRoles) AND .isMember) AND (<std::str>.variant = 'partner'))) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND (<std::str>.variant IN {'official', 'partner'}))) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForStepProgress
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE Project::FinancialApprover {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFinancialApprover
          ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFinancialApprover
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFinancialApprover
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE Project::Member {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForProjectMember
          ALLOW DELETE, INSERT USING ((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProjectMember
          ALLOW SELECT, UPDATE READ USING ((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProjectMember
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE Project::WorkflowEvent {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProjectWorkflowEvent
          ALLOW DELETE USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProjectWorkflowEvent
          ALLOW INSERT USING ((((((((((default::Role.Administrator IN GLOBAL default::currentRoles) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND ((.transitionKey IN <std::uuid>{'1397f444-2dad-5467-aa96-107eae27d807', '7f23ab0e-fe6c-58a5-aaa1-7dd209e3e79a'}) ?? false))) OR ((EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND ((.transitionKey IN <std::uuid>{'1397f444-2dad-5467-aa96-107eae27d807', '7f23ab0e-fe6c-58a5-aaa1-7dd209e3e79a'}) ?? false))) OR ((default::Role.Controller IN GLOBAL default::currentRoles) AND ((.transitionKey IN <std::uuid>{'3c9662f5-db67-5403-b416-7aeeef0fb350', 'a050d4e1-b446-52ab-b6c9-1ab045aa91f5', 'ffff1e49-94ca-5601-ada5-6cc52c93d517', '78af1187-552f-5f7a-b6ec-c737d300aaa9', 'b65b9db4-d5b3-5557-9c1e-a25fc9edc538', '0d9f9039-7099-5faf-9b08-099d47a5cc42', 'a1088f2c-478c-5512-8a60-e4feff5538cc', 'c4663d2d-8b6d-5f45-8fb3-cb71e34555a0', 'ce663888-ca28-55cd-9e9b-1ea5b75e76b2'}) ?? false))) OR ((default::Role.FieldOperationsDirector IN GLOBAL default::currentRoles) AND ((.transitionKey IN <std::uuid>{'a03d96d7-bc75-51d4-b793-88aa02e26cfc', '2f012ffe-893f-52ea-b9f0-39f313b0dd1f', 'aa718b6c-8f16-589c-a0d4-50d5555534d1'}) ?? false))) OR (EXISTS ((<default::Role>{'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND ((.transitionKey IN <std::uuid>{'f48d59a0-67e7-57e2-9f7c-8f9cd8c3c01c', '857c7594-8af8-524e-a61f-15b6ac2bac7d', 'f4726d2a-f92d-58e5-a360-a22560f65971', '9cac7636-b5af-57c7-977d-ddaa2cd837aa'}) ?? false))) OR ((EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND ((.transitionKey IN <std::uuid>{'f48d59a0-67e7-57e2-9f7c-8f9cd8c3c01c', '857c7594-8af8-524e-a61f-15b6ac2bac7d', 'f4726d2a-f92d-58e5-a360-a22560f65971', '9cac7636-b5af-57c7-977d-ddaa2cd837aa'}) ?? false))) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND ((((<std::str>.project.type = 'MomentumTranslation') AND .isMember) AND ((.transitionKey IN <std::uuid>{'1397f444-2dad-5467-aa96-107eae27d807', '7f23ab0e-fe6c-58a5-aaa1-7dd209e3e79a'}) ?? false)) OR (.isMember AND ((.transitionKey IN <std::uuid>{'6ce4c5d0-5034-55c1-bf80-bf5992fe38bf', '37e42c6d-260b-51c7-98c3-d918ba057480', '4edf8b35-b462-590d-bc2c-fd0d20b46a6d', '06c4afc9-2349-50ae-ae4b-a506f5b80dee', '9d2c13e3-d73f-58bc-b68d-c447f0caa91d', 'afe0b316-57ef-5640-a098-4fa1cf0a81b9', '356c7be5-08f5-5f36-a8ad-dfc5509a872e', '3c5607fb-1bba-5c02-a7de-24e4bcf2f27b', 'aa17add1-15eb-5054-80be-809480f8b0eb', '4d495617-2fa4-5dc3-a5ec-63ae21731f1c', '2dc45f2c-c7c8-5f60-9f8c-b9994fcd6b82', '45100e48-16f0-5ac4-a0cb-7e8214414bf8', '04556e06-0efe-5bad-b7a7-9b2524e9c9cf', 'c85a70bb-ff30-5540-8c75-f0c543609418', '479ce997-0cb6-5c38-af9b-a36d3ea24e82', '792e3e28-8237-53a3-893b-e6d4e5476265', '60483d90-c54f-5dd4-b233-b53287ba4324', '7f9b7302-3ea4-5b77-b9ac-7191d11adb94', '006aebaa-83df-5225-add8-062c498191fe', '77ba67dd-b2c3-5e7b-9f33-f55c09279f3e', '0c610243-ba8f-565c-ab17-1b62e1fa6d06', '2537d694-d712-5d3f-8c8a-b07002265e39', '2267fe55-7a97-5aa1-bbc1-403e59f71f9d', 'fe0ec249-f6d6-5ce7-97c4-c19720a057cd', '758a333a-7484-5fb4-aa4c-9c620f542551', '2063137a-7901-5185-b1f8-fe76c56f5c67', 'f4726d2a-f92d-58e5-a360-a22560f65971', '9cac7636-b5af-57c7-977d-ddaa2cd837aa'}) ?? false))))) OR (EXISTS ((<default::Role>{'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND ((.transitionKey IN <std::uuid>{'3e687176-4f02-5f2e-ad5a-374f39504034', '60e21d6d-d4e0-5103-8eee-4f4ff80404b1', '2126603a-13bc-5356-a062-d11647c0f5f6', 'd22e15d9-c4cb-564d-b429-8cef0d482e14', 'b412a3de-d8b9-5068-9e90-e6ead0b4407c', '61b12ecf-6024-54eb-9f49-83b1dc6769f1', '9c8e953f-eecd-5a42-a806-e0e3187dda66', '99dcddcb-4351-5643-a196-9fd93fe68760', 'd5ead4fc-5d99-5a82-8c32-8640ffe26162', 'aa4a45d0-d611-56f2-bd90-d47fc4626d60', 'd9aaa5d1-da74-5042-915f-e7726367ea4e', 'bcfc9f9b-c6d6-59c3-8449-42620f806211', 'f1694429-c062-5895-bff1-12e73cf8eea5', '90fb9642-7b38-510c-bc45-84e722c145b6', 'dae01c7f-13d4-5246-a3f6-2fa3e067b505', 'f7511418-bce7-5901-b141-06a470955a86', '3e19a59f-a414-5c58-a1ff-7bfc6cff7eef', '6b08ebc1-5279-58fc-b2c5-26147b278426', '05d1a69d-e717-5ca9-b011-688cf58a924f', '6ce4c5d0-5034-55c1-bf80-bf5992fe38bf', '37e42c6d-260b-51c7-98c3-d918ba057480', '4edf8b35-b462-590d-bc2c-fd0d20b46a6d', '06c4afc9-2349-50ae-ae4b-a506f5b80dee', '9d2c13e3-d73f-58bc-b68d-c447f0caa91d', 'afe0b316-57ef-5640-a098-4fa1cf0a81b9', '356c7be5-08f5-5f36-a8ad-dfc5509a872e', '3c5607fb-1bba-5c02-a7de-24e4bcf2f27b', 'aa17add1-15eb-5054-80be-809480f8b0eb', '4d495617-2fa4-5dc3-a5ec-63ae21731f1c', '2dc45f2c-c7c8-5f60-9f8c-b9994fcd6b82', '45100e48-16f0-5ac4-a0cb-7e8214414bf8', '04556e06-0efe-5bad-b7a7-9b2524e9c9cf', 'c85a70bb-ff30-5540-8c75-f0c543609418', '479ce997-0cb6-5c38-af9b-a36d3ea24e82', '792e3e28-8237-53a3-893b-e6d4e5476265', '60483d90-c54f-5dd4-b233-b53287ba4324', '7f9b7302-3ea4-5b77-b9ac-7191d11adb94', '006aebaa-83df-5225-add8-062c498191fe', '77ba67dd-b2c3-5e7b-9f33-f55c09279f3e', '0c610243-ba8f-565c-ab17-1b62e1fa6d06', '2537d694-d712-5d3f-8c8a-b07002265e39', '2267fe55-7a97-5aa1-bbc1-403e59f71f9d', 'fe0ec249-f6d6-5ce7-97c4-c19720a057cd', '758a333a-7484-5fb4-aa4c-9c620f542551', '2063137a-7901-5185-b1f8-fe76c56f5c67', 'f4726d2a-f92d-58e5-a360-a22560f65971', '9cac7636-b5af-57c7-977d-ddaa2cd837aa', '1397f444-2dad-5467-aa96-107eae27d807', '7f23ab0e-fe6c-58a5-aaa1-7dd209e3e79a'}) ?? false))));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProjectWorkflowEvent
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'Controller', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProjectWorkflowEvent
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE User::Education {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForEducation
          ALLOW DELETE USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForEducation
          ALLOW INSERT USING (EXISTS ((<default::Role>{'Administrator', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEducation
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForEducation
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE User::Unavailability {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForUnavailability
          ALLOW DELETE USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForUnavailability
          ALLOW INSERT USING (EXISTS ((<default::Role>{'Administrator', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForUnavailability
          ALLOW SELECT, UPDATE READ USING ((EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Intern', 'Mentor'} INTERSECT GLOBAL default::currentRoles)) AND EXISTS ({'Stubbed .isMember for User/Unavailability'}))));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForUnavailability
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Budget {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForBudget
          ALLOW SELECT, UPDATE READ USING ((EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles)) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))));
      CREATE ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForBudget
          ALLOW UPDATE WRITE, DELETE, INSERT ;
  };
  ALTER TYPE default::Engagement {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForEngagement
          ALLOW DELETE USING (((default::Role.Administrator IN GLOBAL default::currentRoles) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND (<std::str>.status = 'InDevelopment'))));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForEngagement
          ALLOW INSERT USING (((default::Role.Administrator IN GLOBAL default::currentRoles) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND (<std::str>.project.status = 'InDevelopment'))));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEngagement
          ALLOW SELECT, UPDATE READ USING ((EXISTS ((<default::Role>{'Administrator', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForEngagement
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForLanguageEngagement
          ALLOW SELECT, UPDATE READ USING ((default::Role.ConsultantManager IN GLOBAL default::currentRoles));
  };
  ALTER TYPE default::Producible {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProducible
          ALLOW DELETE USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProducible
          ALLOW INSERT USING (EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanSelectUpdateReadUpdateWriteGeneratedFromAppPoliciesForProducible
          ALLOW SELECT, UPDATE ;
  };
  ALTER TYPE default::FieldRegion {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFieldRegion
          ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFieldRegion
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFieldRegion
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::FieldZone {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFieldZone
          ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFieldZone
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFieldZone
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::PeriodicReport {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPeriodicReport
          ALLOW SELECT, UPDATE READ USING (WITH
              isMember := 
                  (.container[IS Project::ContextAware].isMember ?? false)
              ,
              sensitivity := 
                  (.container[IS Project::ContextAware].sensitivity ?? default::Sensitivity.High)
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'ConsultantManager', 'Marketing', 'Fundraising', 'ExperienceOperations'} INTERSECT GLOBAL default::currentRoles)) AND (isMember OR (sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND isMember))
          );
      CREATE ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForPeriodicReport
          ALLOW UPDATE WRITE, DELETE, INSERT ;
  };
  ALTER TYPE default::FundingAccount {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFundingAccount
          ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFundingAccount
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFundingAccount
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Location {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForLocation
          ALLOW DELETE, INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadUpdateWriteGeneratedFromAppPoliciesForLocation
          ALLOW SELECT, UPDATE ;
  };
  ALTER TYPE default::NarrativeReport {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForNarrativeReport
          ALLOW SELECT, UPDATE READ USING (WITH
              isMember := 
                  (.container[IS Project::ContextAware].isMember ?? false)
          SELECT
              (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT GLOBAL default::currentRoles)) AND isMember)
          );
  };
  ALTER TYPE default::Organization {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForOrganization
          ALLOW DELETE USING (EXISTS ((<default::Role>{'Administrator', 'Controller'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForOrganization
          ALLOW INSERT USING (EXISTS ((<default::Role>{'Administrator', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForOrganization
          ALLOW SELECT, UPDATE READ USING ((((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ExperienceOperations', 'Fundraising'} INTERSECT GLOBAL default::currentRoles)) AND (.sensitivity <= default::Sensitivity.Medium))) OR ((default::Role.Marketing IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Low)))));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForOrganization
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::Partnership {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForPartnership
          ALLOW DELETE, INSERT USING (((EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPartnership
          ALLOW SELECT, UPDATE READ USING ((((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR ((default::Role.StaffMember IN GLOBAL default::currentRoles) AND (.sensitivity <= default::Sensitivity.Low))));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPartnership
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::ProgressReport {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReport
          ALLOW SELECT, UPDATE READ USING ((EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember));
  };
  ALTER TYPE default::Post {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForPost
          ALLOW DELETE USING (((default::Role.Administrator IN GLOBAL default::currentRoles) OR .isCreator));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForPost
          ALLOW INSERT USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPost
          ALLOW SELECT, UPDATE READ USING ((EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT GLOBAL default::currentRoles)) OR .isCreator));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPost
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE default::User {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForUser
          ALLOW DELETE USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForUser
          ALLOW INSERT USING (EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForUser
          ALLOW SELECT, UPDATE READ USING (((EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (.id ?= GLOBAL default::currentActorId)) OR (EXISTS ((<default::Role>{'Intern', 'Mentor'} INTERSECT GLOBAL default::currentRoles)) AND EXISTS ({'Stubbed .isMember for User/Unavailability'}))));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForUser
          ALLOW UPDATE WRITE ;
  };
};
