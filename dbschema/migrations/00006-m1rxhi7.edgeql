create migration m1rxhi72zd43b4hwanwavpsfx7yo5vfngfr4ngmxq4thpuvi3t45qa
    onto m1jmb5p3ypawyyn6yvctr5of2zp2mw5rd5iyzrxnqmn75eyp3viroq
{
  # Drop all APs temporarily
  alter type Budget::Record {
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForBudgetRecord;
    drop access policy CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForBudgetRecord;
  };
  alter type Comments::Aware {
    drop access policy CanInsertDeleteGeneratedFromAppPoliciesForCommentable;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForCommentable;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForCommentable;
  };
  alter type Comments::Comment {
    drop access policy CanDeleteGeneratedFromAppPoliciesForComment;
    drop access policy CanInsertGeneratedFromAppPoliciesForComment;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForComment;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForComment;
  };
  alter type Comments::Thread {
    drop access policy CanDeleteGeneratedFromAppPoliciesForCommentThread;
    drop access policy CanInsertGeneratedFromAppPoliciesForCommentThread;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForCommentThread;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForCommentThread;
  };
  alter type Engagement::Ceremony {
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForCeremony;
    drop access policy CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForCeremony;
  };
  alter type Ethnologue::Language {
    drop access policy CanInsertDeleteGeneratedFromAppPoliciesForEthnologueLanguage;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForEthnologueLanguage;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForEthnologueLanguage;
  };
  alter type File::Node {
    drop access policy CanInsertDeleteGeneratedFromAppPoliciesForFileNode;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForFileNode;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForFileNode;
  };
  alter type default::Media {
    drop access policy CanInsertDeleteGeneratedFromAppPoliciesForMedia;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForMedia;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForMedia;
  };
  alter type Mixin::Postable {
    drop access policy CanInsertDeleteGeneratedFromAppPoliciesForPostable;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForPostable;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForPostable;
  };
  alter type ProgressReport::CommunityStory {
    drop access policy CanDeleteGeneratedFromAppPoliciesForProgressReportCommunityStory;
    drop access policy CanInsertGeneratedFromAppPoliciesForProgressReportCommunityStory;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportCommunityStory;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForProgressReportCommunityStory;
  };
  alter type ProgressReport::Highlight {
    drop access policy CanDeleteGeneratedFromAppPoliciesForProgressReportHighlight;
    drop access policy CanInsertGeneratedFromAppPoliciesForProgressReportHighlight;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportHighlight;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForProgressReportHighlight;
  };
  alter type ProgressReport::Media {
    drop access policy CanDeleteGeneratedFromAppPoliciesForProgressReportMedia;
    drop access policy CanInsertGeneratedFromAppPoliciesForProgressReportMedia;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportMedia;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForProgressReportMedia;
  };
  alter type ProgressReport::TeamNews {
    drop access policy CanDeleteGeneratedFromAppPoliciesForProgressReportTeamNews;
    drop access policy CanInsertGeneratedFromAppPoliciesForProgressReportTeamNews;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportTeamNews;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForProgressReportTeamNews;
  };
  alter type ProgressReport::VarianceExplanation {
    drop access policy CanInsertDeleteGeneratedFromAppPoliciesForProgressReportVarianceExplanation;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportVarianceExplanation;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForProgressReportVarianceExplanation;
  };
  alter type ProgressReport::WorkflowEvent {
    drop access policy CanDeleteGeneratedFromAppPoliciesForProgressReportWorkflowEvent;
    drop access policy CanInsertGeneratedFromAppPoliciesForProgressReportWorkflowEvent;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportWorkflowEvent;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForProgressReportWorkflowEvent;
  };
  alter type ProgressReport::ProductProgress::Step {
    drop access policy CanInsertDeleteGeneratedFromAppPoliciesForStepProgress;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForStepProgress;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForStepProgress;
  };
  alter type Project::Member {
    drop access policy CanInsertDeleteGeneratedFromAppPoliciesForProjectMember;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProjectMember;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForProjectMember;
  };
  alter type User::Education {
    drop access policy CanDeleteGeneratedFromAppPoliciesForEducation;
    drop access policy CanInsertGeneratedFromAppPoliciesForEducation;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForEducation;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForEducation;
  };
  alter type User::Unavailability {
    drop access policy CanDeleteGeneratedFromAppPoliciesForUnavailability;
    drop access policy CanInsertGeneratedFromAppPoliciesForUnavailability;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForUnavailability;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForUnavailability;
  };
  alter type default::Budget {
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForBudget;
    drop access policy CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForBudget;
  };
  alter type default::Directory {
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForDirectory;
  };
  alter type default::Engagement {
    drop access policy CanDeleteGeneratedFromAppPoliciesForEngagement;
    drop access policy CanInsertGeneratedFromAppPoliciesForEngagement;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForEngagement;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForEngagement;
  };
  alter type default::Producible {
    drop access policy CanDeleteGeneratedFromAppPoliciesForProducible;
    drop access policy CanInsertGeneratedFromAppPoliciesForProducible;
    drop access policy CanSelectUpdateReadUpdateWriteGeneratedFromAppPoliciesForProducible;
  };
  alter type default::FieldRegion {
    drop access policy CanInsertDeleteGeneratedFromAppPoliciesForFieldRegion;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForFieldRegion;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForFieldRegion;
  };
  alter type default::FieldZone {
    drop access policy CanInsertDeleteGeneratedFromAppPoliciesForFieldZone;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForFieldZone;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForFieldZone;
  };
  alter type default::PeriodicReport {
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForPeriodicReport;
    drop access policy CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForPeriodicReport;
  };
  alter type default::FundingAccount {
    drop access policy CanInsertDeleteGeneratedFromAppPoliciesForFundingAccount;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForFundingAccount;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForFundingAccount;
  };
  alter type default::Project {
    drop access policy CanDeleteGeneratedFromAppPoliciesForProject;
    drop access policy CanInsertGeneratedFromAppPoliciesForProject;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProject;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForProject;
  };
  alter type default::Language {
    drop access policy CanInsertDeleteGeneratedFromAppPoliciesForLanguage;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForLanguage;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForLanguage;
  };
  alter type default::LanguageEngagement {
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForLanguageEngagement;
  };
  alter type default::Location {
    drop access policy CanInsertDeleteGeneratedFromAppPoliciesForLocation;
    drop access policy CanSelectUpdateReadUpdateWriteGeneratedFromAppPoliciesForLocation;
  };
  alter type default::NarrativeReport {
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForNarrativeReport;
  };
  alter type default::Organization {
    drop access policy CanDeleteGeneratedFromAppPoliciesForOrganization;
    drop access policy CanInsertGeneratedFromAppPoliciesForOrganization;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForOrganization;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForOrganization;
  };
  alter type default::Partner {
    drop access policy CanDeleteGeneratedFromAppPoliciesForPartner;
    drop access policy CanInsertGeneratedFromAppPoliciesForPartner;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForPartner;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForPartner;
  };
  alter type default::Partnership {
    drop access policy CanInsertDeleteGeneratedFromAppPoliciesForPartnership;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForPartnership;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForPartnership;
  };
  alter type default::Post {
    drop access policy CanDeleteGeneratedFromAppPoliciesForPost;
    drop access policy CanInsertGeneratedFromAppPoliciesForPost;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForPost;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForPost;
  };
  alter type default::ProgressReport {
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReport;
  };
  alter type default::User {
    drop access policy CanDeleteGeneratedFromAppPoliciesForUser;
    drop access policy CanInsertGeneratedFromAppPoliciesForUser;
    drop access policy CanSelectUpdateReadGeneratedFromAppPoliciesForUser;
    drop access policy CanUpdateWriteGeneratedFromAppPoliciesForUser;
  };

  # Introduce Actor / SystemAgents
  create abstract type default::Actor {
    create multi property roles: default::Role;
  };
  alter type default::User {
    extending default::Actor before Mixin::Pinnable;
    alter property roles {
      reset cardinality;
      drop owned;
      reset type;
    };
  };
  create type default::SystemAgent extending default::Actor, Mixin::Named {
    alter property name {
      set owned;
      create constraint std::exclusive;
    };
  };
  insert SystemAgent { name := "Ghost" };
  insert SystemAgent { name := "Anonymous" };
  insert SystemAgent { name := "External Mailing Group", roles := Role.Leadership };

  # Stub Audited
  create abstract type Mixin::Audited extending Mixin::Timestamped;

  create global default::currentActor := (select Actor filter .id = global currentUserId);

  # Switch to extend Resource & Audited
  alter type default::Resource {
    extending Mixin::Audited before Mixin::Timestamped;
  };
  alter type default::Resource {
    drop extending Mixin::Timestamped;
  };
  alter type Prompt::PromptVariantResponse {
    drop extending Mixin::Timestamped;
    extending default::Resource before Mixin::Embedded;
  };
  alter type Prompt::VariantResponse {
    drop extending Mixin::Timestamped;
    extending Mixin::Audited;
  };

  # Drop audited fields that will be inherited
  alter type File::Node {
    drop link createdBy;
    drop link modifiedBy;
  };

  # Add createdBy/modifiedBy to Audited, back-fill from owner
  alter type Mixin::Audited {
    create required link createdBy: default::Actor {
      set default := global default::currentActor;
      set required using (assert_single(
        Mixin::Audited[is Mixin::Owned].owner
        ?? assert_exists((select default::SystemAgent filter .name = 'Ghost'))
      ));
      set readonly := true;
    };
    create required link modifiedBy: default::Actor {
      set default := global default::currentActor;
      set required using (.createdBy);
      create rewrite update using (global default::currentActor);
    };
  };

  # Drop Owned
  alter type Mixin::Owned {
    drop property isOwner;
    drop link owner;
  };
  alter type default::User drop extending Mixin::Owned;
  alter type Comments::Comment drop extending Mixin::Owned;
  alter type Comments::Thread drop extending Mixin::Owned;
  alter type Prompt::PromptVariantResponse drop extending Mixin::Owned;
  alter type Prompt::VariantResponse drop extending Mixin::Owned;
  alter type ProgressReport::Media drop extending Mixin::Owned;
  alter type default::Post drop extending Mixin::Owned;
  drop type Mixin::Owned;

  # Adjust globals
  alter type Mixin::Pinnable {
    drop property pinned;
  };
  alter type default::Post {
    drop property isMember;
  };
  alter type Project::ContextAware {
    drop property isMember;
  };
  alter type default::Project {
    drop link membership;
  };
  alter type ProgressReport::WorkflowEvent {
    alter link who {
      reset default;
    };
  };
  drop alias currentUser;
  alter global currentUserId rename to currentActorId;
  create global currentUser := (select User filter .id = global currentActorId);
  create global currentRoles := (global currentActor).roles;
  alter type ProgressReport::WorkflowEvent {
    alter link who {
      set default := global default::currentUser;
    };
  };
  alter type default::Project {
    create single link membership := (select .members filter .user = global default::currentUser limit 1);
  };
  alter type Project::ContextAware {
    create required single property isMember := exists .projectContext.projects.membership;
  };
  alter type default::Post {
    create single property isMember := .container[is Project::ContextAware].isMember;
  };
  alter type Mixin::Pinnable {
    create property pinned := (
      with user := (select default::User filter .id = global default::currentActorId)
      select __source__ in user.pins
    );
  };

  alter type Mixin::Audited {
    create required property isCreator := (.createdBy ?= global default::currentActor);
  };

  # Adjust triggers to assign defaults explicitly, because bug.
  alter type default::InternshipEngagement {
    alter trigger connectCertificationCeremony using (
      insert Engagement::CertificationCeremony {
        createdAt := std::datetime_of_statement(),
        modifiedAt := std::datetime_of_statement(),
        createdBy := std::assert_exists(global default::currentActor),
        modifiedBy := std::assert_exists(global default::currentActor),
        engagement := __new__,
        project := __new__.project,
        projectContext := __new__.projectContext
      }
    );
  };
  alter type default::LanguageEngagement {
    alter trigger connectDedicationCeremony using (
      insert Engagement::DedicationCeremony {
        createdAt := std::datetime_of_statement(),
        modifiedAt := std::datetime_of_statement(),
        createdBy := std::assert_exists(global default::currentActor),
        modifiedBy := std::assert_exists(global default::currentActor),
        engagement := __new__,
        project := __new__.project,
        projectContext := __new__.projectContext
      }
    );
  };
  alter type default::Project {
    alter trigger createBudgetOnInsert using (
      insert default::Budget {
        createdAt := std::datetime_of_statement(),
        modifiedAt := std::datetime_of_statement(),
        createdBy := std::assert_exists(global default::currentActor),
        modifiedBy := std::assert_exists(global default::currentActor),
        project := __new__,
        projectContext := __new__.projectContext
      }
    );
  };

  # Regenerate policies
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
            ALLOW INSERT USING (((default::Role.Administrator IN GLOBAL default::currentRoles) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
        CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportCommunityStory
            ALLOW SELECT, UPDATE READ USING (((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
        CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportCommunityStory
            ALLOW UPDATE WRITE ;
    };
    ALTER TYPE ProgressReport::Highlight {
        CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportHighlight
            ALLOW DELETE USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
        CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportHighlight
            ALLOW INSERT USING (((default::Role.Administrator IN GLOBAL default::currentRoles) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
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
            ALLOW INSERT USING (((default::Role.Administrator IN GLOBAL default::currentRoles) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
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
    ALTER TYPE Project::Member {
        CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForProjectMember
            ALLOW DELETE, INSERT USING ((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
        CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProjectMember
            ALLOW SELECT, UPDATE READ USING ((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
        CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProjectMember
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
