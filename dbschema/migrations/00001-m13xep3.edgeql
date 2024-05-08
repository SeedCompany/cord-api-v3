CREATE MIGRATION m13xep3dlmh5po2lifdg2sqasl556k5zfzyeyj7j2pc4u4z5rlouia
    ONTO initial
{
  CREATE MODULE Auth IF NOT EXISTS;
  CREATE MODULE Budget IF NOT EXISTS;
  CREATE MODULE Comments IF NOT EXISTS;
  CREATE MODULE Engagement IF NOT EXISTS;
  CREATE MODULE Ethnologue IF NOT EXISTS;
  CREATE MODULE File IF NOT EXISTS;
  CREATE MODULE Location IF NOT EXISTS;
  CREATE MODULE Media IF NOT EXISTS;
  CREATE MODULE Mixin IF NOT EXISTS;
  CREATE MODULE Organization IF NOT EXISTS;
  CREATE MODULE Partner IF NOT EXISTS;
  CREATE MODULE Partnership IF NOT EXISTS;
  CREATE MODULE Post IF NOT EXISTS;
  CREATE MODULE Product IF NOT EXISTS;
  CREATE MODULE ProgressReport IF NOT EXISTS;
  CREATE MODULE ProgressReport::Media IF NOT EXISTS;
  CREATE MODULE ProgressReport::ProductProgress IF NOT EXISTS;
  CREATE MODULE Project IF NOT EXISTS;
  CREATE MODULE Prompt IF NOT EXISTS;
  CREATE MODULE Scripture IF NOT EXISTS;
  CREATE MODULE User IF NOT EXISTS;
  CREATE GLOBAL default::currentUserId -> std::uuid;
  CREATE ABSTRACT TYPE Mixin::Timestamped {
      CREATE REQUIRED PROPERTY createdAt: std::datetime {
          SET default := (std::datetime_of_statement());
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY modifiedAt: std::datetime {
          SET default := (std::datetime_of_statement());
          CREATE REWRITE
              UPDATE 
              USING (std::datetime_of_statement());
      };
  };
  CREATE ABSTRACT TYPE default::Resource EXTENDING Mixin::Timestamped;
  CREATE SCALAR TYPE User::Degree EXTENDING enum<Primary, Secondary, Associates, Bachelors, Masters, Doctorate>;
  CREATE TYPE User::Education EXTENDING default::Resource {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForEducation
          ALLOW UPDATE WRITE ;
      CREATE REQUIRED PROPERTY degree: User::Degree;
      CREATE REQUIRED PROPERTY institution: std::str;
      CREATE REQUIRED PROPERTY major: std::str;
  };
  CREATE TYPE User::Unavailability EXTENDING default::Resource {
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForUnavailability
          ALLOW UPDATE WRITE ;
      CREATE REQUIRED PROPERTY dates: range<cal::local_date>;
      CREATE REQUIRED PROPERTY description: std::str;
  };
  CREATE SCALAR TYPE User::Status EXTENDING enum<Active, Disabled>;
  CREATE SCALAR TYPE default::Role EXTENDING enum<Administrator, BetaTester, BibleTranslationLiaison, Consultant, ConsultantManager, Controller, ExperienceOperations, FieldOperationsDirector, FieldPartner, FinancialAnalyst, Fundraising, Intern, LeadFinancialAnalyst, Leadership, Liaison, Marketing, Mentor, ProjectManager, RegionalCommunicationsCoordinator, RegionalDirector, StaffMember, Translator>;
  CREATE ABSTRACT TYPE Mixin::Pinnable;
  CREATE TYPE default::User EXTENDING default::Resource, Mixin::Pinnable {
      CREATE MULTI LINK pins: Mixin::Pinnable {
          ON TARGET DELETE ALLOW;
      };
      CREATE MULTI LINK education: User::Education {
          ON TARGET DELETE ALLOW;
      };
      CREATE MULTI LINK unavailabilities: User::Unavailability {
          ON TARGET DELETE ALLOW;
      };
      CREATE PROPERTY about: std::str;
      CREATE REQUIRED PROPERTY realFirstName: std::str;
      CREATE REQUIRED PROPERTY displayFirstName: std::str {
          SET default := (.realFirstName);
      };
      CREATE REQUIRED PROPERTY realLastName: std::str;
      CREATE REQUIRED PROPERTY displayLastName: std::str {
          SET default := (.realLastName);
      };
      CREATE PROPERTY email: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY phone: std::str;
      CREATE MULTI PROPERTY roles: default::Role;
      CREATE REQUIRED PROPERTY status: User::Status {
          SET default := (User::Status.Active);
      };
      CREATE REQUIRED PROPERTY timezone: std::str {
          SET default := 'America/Chicago';
      };
      CREATE PROPERTY title: std::str;
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
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForUser
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Intern', 'Mentor'} INTERSECT givenRoles)) AND EXISTS ({'Stubbed .isMember for User/Unavailability'})))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForUser
          ALLOW UPDATE WRITE ;
  };
  ALTER TYPE Mixin::Pinnable {
      CREATE PROPERTY pinned := ((__source__ IN (<default::User>GLOBAL default::currentUserId).pins));
  };
  CREATE ALIAS default::currentUser := (
      <default::User>GLOBAL default::currentUserId
  );
  CREATE SCALAR TYPE default::RichText EXTENDING std::json;
  CREATE ABSTRACT TYPE Mixin::Owned {
      CREATE LINK owner: default::User {
          SET default := (default::currentUser);
      };
      CREATE PROPERTY isOwner := ((.owner = <default::User>GLOBAL default::currentUserId));
  };
  CREATE TYPE Comments::Comment EXTENDING default::Resource, Mixin::Owned {
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
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForComment
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles)) OR (.isOwner ?? false))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForComment
          ALLOW UPDATE WRITE ;
      CREATE REQUIRED PROPERTY body: default::RichText;
  };
  CREATE ABSTRACT TYPE Mixin::Embedded {
      CREATE REQUIRED SINGLE LINK container: default::Resource;
  };
  CREATE TYPE Comments::Thread EXTENDING default::Resource, Mixin::Embedded, Mixin::Owned {
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
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForCommentThread
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles)) OR (.isOwner ?? false))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForCommentThread
          ALLOW UPDATE WRITE ;
  };
  CREATE ABSTRACT TYPE Mixin::Named {
      CREATE REQUIRED PROPERTY name: std::str;
      CREATE INDEX fts::index ON (fts::with_options(.name, language := fts::Language.eng));
  };
  CREATE ABSTRACT TYPE File::Node EXTENDING default::Resource, Mixin::Named {
      CREATE REQUIRED LINK createdBy: default::User {
          SET default := (default::currentUser);
      };
      CREATE REQUIRED LINK modifiedBy: default::User {
          SET default := (default::currentUser);
          CREATE REWRITE
              UPDATE 
              USING (default::currentUser);
      };
      CREATE LINK parent: File::Node;
      CREATE MULTI LINK parents: File::Node {
          CREATE PROPERTY depth: std::int16;
      };
      CREATE PROPERTY public: std::bool;
      CREATE REQUIRED PROPERTY size: std::int64;
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFileNode
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFileNode
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFileNode
          ALLOW UPDATE WRITE ;
  };
  CREATE TYPE File::Version EXTENDING File::Node {
      CREATE REQUIRED PROPERTY mimeType: std::str;
  };
  CREATE TYPE default::Directory EXTENDING File::Node {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForDirectory
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles))
          );
      CREATE REQUIRED PROPERTY totalFiles: std::int32 {
          SET default := 0;
      };
  };
  CREATE ABSTRACT TYPE default::Media {
      CREATE REQUIRED LINK file: File::Version {
          SET readonly := true;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY altText: std::str;
      CREATE PROPERTY caption: std::str;
      CREATE REQUIRED PROPERTY mimeType: std::str;
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForMedia
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForMedia
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForMedia
          ALLOW UPDATE WRITE ;
  };
  CREATE TYPE default::File EXTENDING File::Node {
      CREATE REQUIRED LINK latestVersion: File::Version;
      CREATE SINGLE LINK media := (.latestVersion.<file[IS default::Media]);
      CREATE REQUIRED PROPERTY mimeType: std::str;
  };
  CREATE SCALAR TYPE Project::Status EXTENDING enum<InDevelopment, Active, Terminated, Completed, DidNotDevelop>;
  CREATE SCALAR TYPE Project::Step EXTENDING enum<EarlyConversations, PendingConceptApproval, PrepForConsultantEndorsement, PendingConsultantEndorsement, PrepForFinancialEndorsement, PendingFinancialEndorsement, FinalizingProposal, PendingRegionalDirectorApproval, PendingZoneDirectorApproval, PendingFinanceConfirmation, OnHoldFinanceConfirmation, DidNotDevelop, Rejected, Active, ActiveChangedPlan, DiscussingChangeToPlan, PendingChangeToPlanApproval, PendingChangeToPlanConfirmation, DiscussingSuspension, PendingSuspensionApproval, Suspended, DiscussingReactivation, PendingReactivationApproval, DiscussingTermination, PendingTerminationApproval, FinalizingCompletion, Terminated, Completed>;
  CREATE FUNCTION Project::statusFromStep(step: Project::Step) ->  Project::Status USING (WITH
      dev := 
          {Project::Step.EarlyConversations, Project::Step.PendingConceptApproval, Project::Step.PrepForConsultantEndorsement, Project::Step.PendingConsultantEndorsement, Project::Step.PrepForFinancialEndorsement, Project::Step.PendingFinancialEndorsement, Project::Step.FinalizingProposal, Project::Step.PendingRegionalDirectorApproval, Project::Step.PendingZoneDirectorApproval, Project::Step.PendingFinanceConfirmation, Project::Step.OnHoldFinanceConfirmation}
      ,
      active := 
          {Project::Step.Active, Project::Step.ActiveChangedPlan, Project::Step.DiscussingChangeToPlan, Project::Step.PendingChangeToPlanApproval, Project::Step.PendingChangeToPlanConfirmation, Project::Step.DiscussingSuspension, Project::Step.PendingSuspensionApproval, Project::Step.Suspended, Project::Step.DiscussingReactivation, Project::Step.PendingReactivationApproval, Project::Step.DiscussingTermination, Project::Step.PendingTerminationApproval, Project::Step.FinalizingCompletion}
  SELECT
      (Project::Status.InDevelopment IF (step IN dev) ELSE (Project::Status.Active IF (step IN active) ELSE (Project::Status.DidNotDevelop IF (step = Project::Step.DidNotDevelop) ELSE (Project::Status.DidNotDevelop IF (step = Project::Step.Rejected) ELSE (Project::Status.Terminated IF (step = Project::Step.Terminated) ELSE (Project::Status.Completed IF (step = Project::Step.Completed) ELSE Project::Status.InDevelopment))))))
  );
  CREATE FUNCTION default::date_range_get_upper(period: range<cal::local_date>) ->  cal::local_date USING ((<cal::local_date><std::str>std::assert_exists(std::range_get_upper(period)) - <cal::date_duration>'1 day'));
  CREATE SCALAR TYPE Post::Shareability EXTENDING enum<Membership, Internal, AskToShareExternally, External>;
  CREATE SCALAR TYPE Post::Type EXTENDING enum<Note, Story, Prayer>;
  CREATE SCALAR TYPE default::Sensitivity EXTENDING enum<Low, Medium, High>;
  CREATE TYPE default::Post EXTENDING default::Resource, Mixin::Embedded, Mixin::Owned {
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
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPost
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles)) OR (.isOwner ?? false))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPost
          ALLOW UPDATE WRITE ;
      CREATE REQUIRED PROPERTY body: default::RichText;
      CREATE REQUIRED PROPERTY shareability: Post::Shareability;
      CREATE REQUIRED PROPERTY type: Post::Type;
  };
  CREATE SCALAR TYPE default::nanoid EXTENDING std::str;
  CREATE ABSTRACT TYPE Project::ContextAware {
      CREATE OPTIONAL PROPERTY ownSensitivity: default::Sensitivity {
          CREATE ANNOTATION std::description := "A writable source of a sensitivity. This doesn't necessarily mean it be the same as .sensitivity, which is what is used for authorization.";
      };
      CREATE ANNOTATION std::description := 'A type that has a project context, which allows it to be\n      aware of the sensitivity & current user membership for the associated context.';
  };
  CREATE ABSTRACT TYPE Project::Child EXTENDING default::Resource, Project::ContextAware {
      CREATE ANNOTATION std::description := 'A type that is a child of a project. It will always have a reference to a single project that it is under.';
  };
  CREATE ABSTRACT TYPE Engagement::Child EXTENDING Project::Child {
      CREATE ANNOTATION std::description := 'A type that is a child of an engagement. It will always have a reference to a single engagement & project that it is under.';
  };
  CREATE ABSTRACT TYPE ProgressReport::Child EXTENDING Engagement::Child {
      CREATE ANNOTATION std::description := 'A type that is a child of a progress report. It will always have a reference to a single progress report and engagement that it is under.';
  };
  CREATE ABSTRACT TYPE Prompt::PromptVariantResponse EXTENDING Mixin::Embedded, Mixin::Timestamped, Mixin::Owned {
      CREATE PROPERTY promptId: default::nanoid;
      CREATE ANNOTATION std::description := 'An instance of a prompt and the responses per variant.';
  };
  CREATE TYPE ProgressReport::CommunityStory EXTENDING ProgressReport::Child, Prompt::PromptVariantResponse {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportCommunityStory
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportCommunityStory
          ALLOW UPDATE WRITE ;
  };
  CREATE TYPE ProgressReport::Media::VariantGroup;
  CREATE TYPE ProgressReport::Media EXTENDING ProgressReport::Child, Mixin::Owned {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportMedia
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR (.isOwner ?? false))
          );
      CREATE REQUIRED PROPERTY variant: std::str;
      CREATE REQUIRED LINK file: default::File;
      CREATE REQUIRED SINGLE LINK media := (std::assert_exists(.file.media));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportMedia
          ALLOW UPDATE WRITE ;
      CREATE REQUIRED LINK variantGroup: ProgressReport::Media::VariantGroup;
      CREATE CONSTRAINT std::exclusive ON ((.variantGroup, .variant));
      CREATE TRIGGER deleteEmptyVariantGroup
          AFTER DELETE 
          FOR EACH DO (DELETE
              __old__.variantGroup
          FILTER
              NOT (EXISTS ((SELECT
                  ProgressReport::Media
              FILTER
                  (.variantGroup = __old__.variantGroup)
              )))
          );
      CREATE PROPERTY category: std::str;
  };
  CREATE TYPE ProgressReport::TeamNews EXTENDING ProgressReport::Child, Prompt::PromptVariantResponse {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportTeamNews
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportTeamNews
          ALLOW UPDATE WRITE ;
  };
  CREATE TYPE ProgressReport::Highlight EXTENDING ProgressReport::Child, Prompt::PromptVariantResponse {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportHighlight
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportHighlight
          ALLOW UPDATE WRITE ;
  };
  CREATE TYPE Prompt::VariantResponse EXTENDING Mixin::Timestamped, Mixin::Owned {
      CREATE REQUIRED LINK pvr: Prompt::PromptVariantResponse;
      CREATE REQUIRED PROPERTY variant: std::str;
      CREATE CONSTRAINT std::exclusive ON ((.pvr, .variant));
      CREATE ANNOTATION std::description := 'A response (for a variant) to an instance of a prompt.';
      CREATE PROPERTY response: default::RichText;
  };
  CREATE SCALAR TYPE ProgressReport::Status EXTENDING enum<NotStarted, InProgress, PendingTranslation, InReview, Approved, Published>;
  CREATE TYPE ProgressReport::WorkflowEvent {
      CREATE REQUIRED LINK who: default::User {
          SET default := (default::currentUser);
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY at: std::datetime {
          SET default := (std::datetime_of_statement());
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY status: ProgressReport::Status {
          SET readonly := true;
      };
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProgressReportWorkflowEvent
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE PROPERTY transitionId: default::nanoid {
          SET readonly := true;
      };
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportWorkflowEvent
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (((((default::Role.Administrator IN givenRoles) OR ((default::Role.FieldPartner IN givenRoles) AND ((.transitionId IN {'5da76b5163', 'cb18f58cbf', '651d2a4dcc', 'e14c52346b'}) ?? false))) OR ((default::Role.Marketing IN givenRoles) AND ((.transitionId = '2d88e3cd6e') ?? false))) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND ((.transitionId IN {'5da76b5163', 'cb18f58cbf', '651d2a4dcc', '580377ea2b', '0d854e832e', 'e14c52346b', '2b137bcd66', 'a0c0c48a8c', 'e3e11c86b9'}) ?? false))) OR ((default::Role.Translator IN givenRoles) AND ((.transitionId IN {'580377ea2b', '0d854e832e'}) ?? false)))
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportWorkflowEvent
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportWorkflowEvent
          ALLOW UPDATE WRITE ;
      CREATE PROPERTY notes: default::RichText {
          SET readonly := true;
      };
  };
  CREATE TYPE Project::Context {
      CREATE ANNOTATION std::description := 'A type that holds a reference to a list of projects. This allows multiple objects to hold a reference to the same list. For example, Language & Ethnologue::Language share the same context / project list.';
  };
  CREATE ABSTRACT TYPE Mixin::Taggable {
      CREATE MULTI PROPERTY tags: std::str;
  };
  ALTER TYPE Project::ContextAware {
      CREATE REQUIRED LINK projectContext: Project::Context {
          ON TARGET DELETE DELETE SOURCE;
      };
  };
  CREATE SCALAR TYPE default::ReportPeriod EXTENDING enum<Monthly, Quarterly>;
  CREATE ABSTRACT TYPE Comments::Aware EXTENDING default::Resource {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForCommentable
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForCommentable
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForCommentable
          ALLOW UPDATE WRITE ;
  };
  CREATE ABSTRACT TYPE Mixin::Postable EXTENDING default::Resource {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForPostable
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPostable
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Leadership'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPostable
          ALLOW UPDATE WRITE ;
  };
  CREATE ABSTRACT TYPE default::Project EXTENDING Mixin::Postable, Comments::Aware, default::Resource, Project::ContextAware, Mixin::Named, Mixin::Pinnable, Mixin::Taggable {
      ALTER PROPERTY ownSensitivity {
          SET default := (default::Sensitivity.High);
          SET OWNED;
          SET REQUIRED;
          SET TYPE default::Sensitivity;
          CREATE ANNOTATION std::description := 'The sensitivity of the project. This is user settable for internships and calculated for translation projects';
      };
      CREATE PROPERTY mouEnd: cal::local_date;
      CREATE PROPERTY mouStart: cal::local_date;
      CREATE REQUIRED PROPERTY step: Project::Step {
          SET default := (Project::Step.EarlyConversations);
      };
      CREATE PROPERTY status := (Project::statusFromStep(.step));
      ALTER LINK projectContext {
          SET default := (INSERT
              Project::Context
          );
          ON SOURCE DELETE DELETE TARGET;
          SET OWNED;
          SET TYPE Project::Context;
      };
      CREATE LINK rootDirectory: default::Directory;
      CREATE PROPERTY departmentId: std::str {
          CREATE CONSTRAINT std::exclusive;
          CREATE CONSTRAINT std::expression ON (((<std::int32>__subject__ > 0) AND (std::len(__subject__) = 5)));
      };
      CREATE PROPERTY estimatedSubmission: cal::local_date;
      CREATE PROPERTY financialReportPeriod: default::ReportPeriod;
      CREATE PROPERTY financialReportReceivedAt: std::datetime;
      CREATE PROPERTY initialMouEnd: cal::local_date {
          SET default := (.mouEnd);
          CREATE REWRITE
              UPDATE 
              USING ((.mouEnd IF (.status = Project::Status.InDevelopment) ELSE .initialMouEnd));
      };
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED PROPERTY stepChangedAt: std::datetime {
          SET default := (.createdAt);
          CREATE REWRITE
              UPDATE 
              USING ((std::datetime_of_statement() IF (.step != __old__.step) ELSE .stepChangedAt));
      };
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
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProject
          ALLOW UPDATE WRITE ;
      CREATE CONSTRAINT std::expression ON ((.mouEnd >= .mouStart));
  };
  ALTER TYPE Project::Context {
      CREATE MULTI LINK projects: default::Project {
          ON TARGET DELETE ALLOW;
      };
  };
  ALTER TYPE Project::Child {
      CREATE REQUIRED LINK project: default::Project {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
  };
  ALTER TYPE Project::ContextAware {
      CREATE REQUIRED SINGLE PROPERTY sensitivity := ((std::max(.projectContext.projects.ownSensitivity) ?? (.ownSensitivity ?? default::Sensitivity.High)));
  };
  CREATE TYPE Project::Member EXTENDING Project::Child {
      CREATE REQUIRED LINK user: default::User {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProjectMember
          ALLOW UPDATE WRITE ;
      CREATE CONSTRAINT std::exclusive ON ((.project, .user));
      CREATE MULTI PROPERTY roles: default::Role;
  };
  ALTER TYPE default::Project {
      CREATE MULTI LINK members := (.<project[IS Project::Member]);
      CREATE SINGLE LINK membership := (SELECT
          .members FILTER
              (.user.id = GLOBAL default::currentUserId)
      LIMIT
          1
      );
  };
  ALTER TYPE Project::ContextAware {
      CREATE REQUIRED SINGLE PROPERTY isMember := (EXISTS (.projectContext.projects.membership));
      CREATE INDEX ON (.projectContext);
  };
  CREATE SCALAR TYPE Engagement::Status EXTENDING enum<InDevelopment, DidNotDevelop, Rejected, Active, DiscussingTermination, DiscussingReactivation, DiscussingChangeToPlan, DiscussingSuspension, FinalizingCompletion, ActiveChangedPlan, Suspended, Terminated, Completed, Converted, Unapproved, Transferred, NotRenewed>;
  CREATE ABSTRACT TYPE default::Engagement EXTENDING Project::Child {
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForEngagement
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles)) AND .isMember) AND (<std::str>.project.status = 'InDevelopment')))
          );
      CREATE PROPERTY completedDate: cal::local_date {
          CREATE ANNOTATION std::description := 'Translation / Growth Plan complete date';
      };
      CREATE PROPERTY description: default::RichText;
      CREATE PROPERTY disbursementCompleteDate: cal::local_date;
      CREATE PROPERTY endDateOverride: cal::local_date;
      CREATE PROPERTY endDate := ((.endDateOverride ?? .project.mouEnd));
      CREATE PROPERTY initialEndDate: cal::local_date;
      CREATE PROPERTY lastReactivatedAt: std::datetime;
      CREATE PROPERTY lastSuspendedAt: std::datetime;
      CREATE PROPERTY startDateOverride: cal::local_date;
      CREATE PROPERTY startDate := ((.startDateOverride ?? .project.mouStart));
      CREATE REQUIRED PROPERTY status: Engagement::Status {
          SET default := (Engagement::Status.InDevelopment);
      };
      CREATE PROPERTY statusModifiedAt: std::datetime {
          CREATE REWRITE
              UPDATE 
              USING ((std::datetime_of_statement() IF (.status != __old__.status) ELSE .statusModifiedAt));
      };
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForEngagement
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles)) AND .isMember) AND (<std::str>.status = 'InDevelopment')))
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEngagement
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForEngagement
          ALLOW UPDATE WRITE ;
      ALTER PROPERTY initialEndDate {
          CREATE REWRITE
              INSERT 
              USING ((.endDate IF (.status = Engagement::Status.InDevelopment) ELSE .initialEndDate));
          CREATE REWRITE
              UPDATE 
              USING ((.endDate IF (.status = Engagement::Status.InDevelopment) ELSE .initialEndDate));
      };
      ALTER PROPERTY lastReactivatedAt {
          CREATE REWRITE
              UPDATE 
              USING ((std::datetime_of_statement() IF (((.status != __old__.status) AND (.status = Engagement::Status.Active)) AND (__old__.status = Engagement::Status.Suspended)) ELSE .lastReactivatedAt));
      };
      ALTER PROPERTY lastSuspendedAt {
          CREATE REWRITE
              UPDATE 
              USING ((std::datetime_of_statement() IF ((.status != __old__.status) AND (.status = Engagement::Status.Suspended)) ELSE .lastSuspendedAt));
      };
  };
  ALTER TYPE Comments::Thread {
      ALTER LINK container {
          SET SINGLE;
          ON TARGET DELETE DELETE SOURCE;
          SET OWNED;
          SET REQUIRED;
          SET TYPE Comments::Aware USING (<Comments::Aware>{});
      };
  };
  ALTER TYPE Comments::Aware {
      CREATE LINK commentThreads := (.<container[IS Comments::Thread]);
  };
  ALTER TYPE default::Post {
      ALTER LINK container {
          SET SINGLE;
          ON TARGET DELETE DELETE SOURCE;
          SET OWNED;
          SET REQUIRED;
          SET TYPE Mixin::Postable USING (<Mixin::Postable>{});
      };
  };
  ALTER TYPE Mixin::Postable {
      CREATE LINK posts := (.<container[IS default::Post]);
  };
  CREATE TYPE default::InternshipEngagement EXTENDING default::Engagement {
      CREATE LINK growthPlan: default::File;
      CREATE REQUIRED LINK intern: default::User {
          SET readonly := true;
      };
      CREATE LINK mentor: default::User;
  };
  CREATE TYPE default::InternshipProject EXTENDING default::Project;
  ALTER TYPE default::InternshipEngagement {
      ALTER LINK project {
          SET OWNED;
          SET REQUIRED;
          SET TYPE default::InternshipProject USING (<default::InternshipProject>{});
      };
  };
  CREATE TYPE default::LanguageEngagement EXTENDING default::Engagement {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForLanguageEngagement
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.ConsultantManager IN givenRoles)
          );
      CREATE LINK pnp: default::File;
      CREATE PROPERTY historicGoal: std::str {
          CREATE ANNOTATION std::deprecated := 'Legacy data';
      };
      CREATE REQUIRED PROPERTY lukePartnership: std::bool {
          SET default := false;
      };
      CREATE REQUIRED PROPERTY openToInvestorVisit: std::bool {
          SET default := false;
      };
      CREATE PROPERTY paratextRegistryId: std::str;
      CREATE PROPERTY sentPrintingDate: cal::local_date {
          CREATE ANNOTATION std::deprecated := 'Legacy data';
      };
  };
  ALTER TYPE default::Project {
      CREATE PROPERTY engagementTotal := (std::count(.<project[IS default::Engagement]));
  };
  CREATE ABSTRACT TYPE default::TranslationProject EXTENDING default::Project;
  ALTER TYPE default::LanguageEngagement {
      ALTER LINK project {
          SET OWNED;
          SET REQUIRED;
          SET TYPE default::TranslationProject USING (<default::TranslationProject>{});
      };
  };
  ALTER TYPE default::TranslationProject {
      CREATE MULTI LINK engagements := (.<project[IS default::LanguageEngagement]);
  };
  CREATE TYPE default::MomentumTranslationProject EXTENDING default::TranslationProject;
  CREATE TYPE default::MultiplicationTranslationProject EXTENDING default::TranslationProject;
  CREATE TYPE default::FundingAccount EXTENDING default::Resource, Mixin::Named {
      CREATE REQUIRED PROPERTY accountNumber: std::int16 {
          CREATE CONSTRAINT std::expression ON (((__subject__ >= 0) AND (__subject__ <= 9)));
      };
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFundingAccount
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFundingAccount
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFundingAccount
          ALLOW UPDATE WRITE ;
  };
  CREATE SCALAR TYPE Location::IsoAlpha3Code EXTENDING std::str {
      CREATE CONSTRAINT std::regexp('^[A-Z]{3}$');
  };
  CREATE SCALAR TYPE Location::Type EXTENDING enum<Country, City, County, Region, State, CrossBorderArea>;
  CREATE TYPE default::Location EXTENDING default::Resource, Mixin::Named {
      CREATE LINK fundingAccount: default::FundingAccount;
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForLocation
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE LINK mapImage: default::File;
      CREATE ACCESS POLICY CanSelectUpdateReadUpdateWriteGeneratedFromAppPoliciesForLocation
          ALLOW SELECT, UPDATE ;
      CREATE LINK defaultMarketingRegion: default::Location;
      CREATE PROPERTY isoAlpha3: Location::IsoAlpha3Code {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED PROPERTY type: Location::Type;
  };
  ALTER TYPE default::Project {
      CREATE LINK primaryLocation: default::Location;
      ALTER PROPERTY departmentId {
          CREATE REWRITE
              INSERT 
              USING ((IF ((NOT (EXISTS (.departmentId)) AND (.status <= Project::Status.Active)) AND (.step >= Project::Step.PendingFinanceConfirmation)) THEN (WITH
                  fa := 
                      std::assert_exists(__subject__.primaryLocation.fundingAccount, message := 'Project must have a primary location')
                  ,
                  existing := 
                      (SELECT
                          (DETACHED default::Project).departmentId
                      FILTER
                          (default::Project.primaryLocation.fundingAccount = fa)
                      )
                  ,
                  available := 
                      (<std::str>std::range_unpack(std::range(((fa.accountNumber * 10000) + 11), ((fa.accountNumber * 10000) + 9999))) EXCEPT existing)
              SELECT
                  std::min(available)
              ) ELSE .departmentId));
          CREATE REWRITE
              UPDATE 
              USING ((IF ((NOT (EXISTS (.departmentId)) AND (.status <= Project::Status.Active)) AND (.step >= Project::Step.PendingFinanceConfirmation)) THEN (WITH
                  fa := 
                      std::assert_exists(__subject__.primaryLocation.fundingAccount, message := 'Project must have a primary location')
                  ,
                  existing := 
                      (SELECT
                          (DETACHED default::Project).departmentId
                      FILTER
                          (default::Project.primaryLocation.fundingAccount = fa)
                      )
                  ,
                  available := 
                      (<std::str>std::range_unpack(std::range(((fa.accountNumber * 10000) + 11), ((fa.accountNumber * 10000) + 9999))) EXCEPT existing)
              SELECT
                  std::min(available)
              ) ELSE .departmentId));
      };
  };
  CREATE ABSTRACT TYPE default::PeriodicReport EXTENDING default::Resource, Mixin::Embedded {
      CREATE REQUIRED PROPERTY period: range<cal::local_date>;
      CREATE PROPERTY `end` := (default::date_range_get_upper(.period));
      CREATE LINK reportFile: default::File;
      CREATE PROPERTY receivedDate: cal::local_date;
      CREATE PROPERTY skippedReason: std::str;
      CREATE PROPERTY `start` := (std::range_get_lower(.period));
      CREATE ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForPeriodicReport
          ALLOW UPDATE WRITE, DELETE, INSERT ;
  };
  CREATE TYPE default::FinancialReport EXTENDING default::PeriodicReport, Project::Child {
      ALTER LINK container {
          SET OWNED;
          SET TYPE default::Project USING (<default::Project>{});
      };
  };
  CREATE TYPE default::NarrativeReport EXTENDING default::PeriodicReport, Project::Child {
      ALTER LINK container {
          SET OWNED;
          SET TYPE default::Project USING (<default::Project>{});
      };
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
  ALTER TYPE Engagement::Child {
      CREATE REQUIRED LINK engagement: default::Engagement {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
  };
  CREATE TYPE default::ProgressReport EXTENDING default::PeriodicReport, Engagement::Child {
      ALTER LINK container {
          SET OWNED;
          SET TYPE default::LanguageEngagement USING (<default::LanguageEngagement>{});
      };
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReport
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember)
          );
      ALTER LINK engagement {
          SET OWNED;
          SET TYPE default::LanguageEngagement USING (<default::LanguageEngagement>{});
      };
  };
  CREATE FUNCTION default::hydrate(typeName: std::str, scopedValue: std::json) ->  std::str USING (typeName);
  CREATE FUNCTION default::str_clean(string: std::str) -> OPTIONAL std::str USING (WITH
      trimmed := 
          std::str_trim(string, ' \t\r\n')
  SELECT
      (IF (std::len(trimmed) > 0) THEN trimmed ELSE <std::str>{})
  );
  ALTER TYPE Mixin::Named {
      ALTER PROPERTY name {
          CREATE REWRITE
              INSERT 
              USING (default::str_clean(.name));
          CREATE REWRITE
              UPDATE 
              USING (default::str_clean(.name));
      };
  };
  CREATE FUNCTION default::str_sortable(value: std::str) ->  std::str USING (std::str_lower(std::re_replace('Ñ', 'N', std::str_trim(std::re_replace(r'[ [\]|,\-$]+', ' ', value, flags := 'g')), flags := 'g')));
  ALTER TYPE Mixin::Named {
      CREATE INDEX ON (default::str_sortable(.name));
  };
  CREATE ABSTRACT TYPE default::Producible EXTENDING default::Resource, Mixin::Named {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE DELEGATED CONSTRAINT std::exclusive;
      };
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
      CREATE ACCESS POLICY CanSelectUpdateReadUpdateWriteGeneratedFromAppPoliciesForProducible
          ALLOW SELECT, UPDATE ;
  };
  CREATE TYPE default::EthnoArt EXTENDING default::Producible;
  CREATE TYPE default::FieldRegion EXTENDING default::Resource, Mixin::Named {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFieldRegion
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFieldRegion
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFieldRegion
          ALLOW UPDATE WRITE ;
      CREATE REQUIRED LINK director: default::User;
  };
  CREATE TYPE default::FieldZone EXTENDING default::Resource, Mixin::Named {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForFieldZone
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForFieldZone
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForFieldZone
          ALLOW UPDATE WRITE ;
      CREATE REQUIRED LINK director: default::User;
  };
  CREATE TYPE default::Film EXTENDING default::Producible;
  ALTER TYPE default::Project {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProject
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Fundraising', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'RegionalDirector', 'FieldOperationsDirector', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE default::InternshipProject {
      CREATE MULTI LINK engagements := (.<project[IS default::InternshipEngagement]);
  };
  CREATE SCALAR TYPE default::population EXTENDING std::int32 {
      CREATE CONSTRAINT std::expression ON ((__subject__ >= 0));
  };
  CREATE TYPE default::Language EXTENDING Mixin::Postable, default::Resource, Project::ContextAware, Mixin::Named, Mixin::Pinnable, Mixin::Taggable {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForLanguage
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      ALTER LINK projectContext {
          SET default := (INSERT
              Project::Context
          );
          ON SOURCE DELETE DELETE TARGET;
          SET OWNED;
          SET TYPE Project::Context;
      };
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForLanguage
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Fundraising', 'Marketing', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
      ALTER PROPERTY ownSensitivity {
          SET default := (default::Sensitivity.High);
          SET OWNED;
          SET REQUIRED;
          SET TYPE default::Sensitivity;
          CREATE ANNOTATION std::description := 'The sensitivity of the language. This is a source / user settable.';
      };
      CREATE PROPERTY populationOverride: default::population;
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForLanguage
          ALLOW UPDATE WRITE ;
      CREATE OPTIONAL LINK firstScriptureEngagement: default::LanguageEngagement;
      CREATE REQUIRED PROPERTY hasExternalFirstScripture: std::bool {
          SET default := false;
      };
      CREATE CONSTRAINT std::expression ON (((EXISTS (.firstScriptureEngagement) AND NOT (.hasExternalFirstScripture)) OR NOT (EXISTS (.firstScriptureEngagement))));
      CREATE REQUIRED PROPERTY isDialect: std::bool {
          SET default := false;
      };
      CREATE REQUIRED PROPERTY isSignLanguage: std::bool {
          SET default := false;
      };
      CREATE REQUIRED PROPERTY leastOfThese: std::bool {
          SET default := false;
      };
      CREATE INDEX ON ((.name, .ownSensitivity, .leastOfThese, .isSignLanguage, .isDialect));
      CREATE REQUIRED PROPERTY displayName: std::str {
          SET default := (.name);
      };
      CREATE PROPERTY displayNamePronunciation: std::str;
      CREATE PROPERTY leastOfTheseReason: std::str;
      CREATE PROPERTY registryOfDialectsCode: std::str {
          CREATE CONSTRAINT std::exclusive;
          CREATE CONSTRAINT std::regexp('^[0-9]{5}$');
      };
      CREATE PROPERTY signLanguageCode: std::str {
          CREATE CONSTRAINT std::regexp(r'^[A-Z]{2}\d{2}$');
      };
      CREATE PROPERTY sponsorEstimatedEndDate: cal::local_date;
  };
  ALTER TYPE default::Location {
      CREATE LINK defaultFieldRegion: default::FieldRegion;
  };
  CREATE SCALAR TYPE Organization::Reach EXTENDING enum<Local, Regional, National, `Global`>;
  CREATE SCALAR TYPE Organization::Type EXTENDING enum<Church, Parachurch, Mission, TranslationOrganization, Alliance>;
  CREATE TYPE default::Organization EXTENDING default::Resource, Project::ContextAware, Mixin::Named {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForOrganization
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Controller'} INTERSECT givenRoles))
          );
      ALTER LINK projectContext {
          SET default := (INSERT
              Project::Context
          );
          ON SOURCE DELETE DELETE TARGET;
          SET OWNED;
          SET TYPE Project::Context;
      };
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForOrganization
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForOrganization
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT givenRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ExperienceOperations', 'Fundraising'} INTERSECT givenRoles)) AND (.sensitivity <= default::Sensitivity.Medium))) OR ((default::Role.Marketing IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Low))))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForOrganization
          ALLOW UPDATE WRITE ;
      CREATE PROPERTY acronym: std::str;
      CREATE MULTI PROPERTY reach: Organization::Reach;
      CREATE MULTI PROPERTY types: Organization::Type;
  };
  CREATE SCALAR TYPE Partner::Type EXTENDING enum<Managing, Funding, Impact, Technical, Resource>;
  CREATE SCALAR TYPE Partnership::FinancialReportingType EXTENDING enum<Funded, FieldEngaged, Hybrid>;
  CREATE TYPE default::Partner EXTENDING Mixin::Postable, default::Resource, Project::ContextAware, Mixin::Named, Mixin::Pinnable, Mixin::Taggable {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForPartner
          ALLOW DELETE USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'Controller'} INTERSECT givenRoles))
          );
      CREATE REQUIRED LINK organization: default::Organization {
          ON SOURCE DELETE DELETE TARGET;
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForPartner
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              EXISTS ((<default::Role>{'Administrator', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles))
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPartner
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT givenRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ExperienceOperations', 'Fundraising'} INTERSECT givenRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR ((default::Role.Marketing IN givenRoles) AND ((.isMember AND (.sensitivity <= default::Sensitivity.Medium)) OR (.sensitivity <= default::Sensitivity.Low)))) OR ((default::Role.StaffMember IN givenRoles) AND (.sensitivity <= default::Sensitivity.Low)))
          );
      CREATE MULTI LINK fieldRegions: default::FieldRegion;
      CREATE LINK languageOfWiderCommunication: default::Language;
      CREATE MULTI LINK languagesOfConsulting: default::Language;
      CREATE MULTI LINK countries: default::Location;
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPartner
          ALLOW UPDATE WRITE ;
      CREATE LINK pointOfContact: default::User;
      CREATE REQUIRED PROPERTY active: std::bool {
          SET default := true;
      };
      CREATE MULTI PROPERTY financialReportingTypes: Partnership::FinancialReportingType;
      CREATE REQUIRED PROPERTY globalInnovationsClient: std::bool {
          SET default := false;
      };
      CREATE PROPERTY pmcEntityCode: std::str {
          CREATE CONSTRAINT std::regexp('^[A-Z]{3}$');
      };
      CREATE MULTI PROPERTY types: Partner::Type;
  };
  CREATE TYPE default::Story EXTENDING default::Producible;
  CREATE TYPE Budget::Record EXTENDING Project::Child {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForBudgetRecord
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium))))
          );
      CREATE ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForBudgetRecord
          ALLOW UPDATE WRITE, DELETE, INSERT ;
      CREATE REQUIRED LINK organization: default::Organization {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY fiscalYear: std::int16 {
          SET readonly := true;
      };
      CREATE PROPERTY amount: std::float32;
  };
  CREATE ABSTRACT TYPE Engagement::Ceremony EXTENDING Engagement::Child {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForCeremony
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
      CREATE PROPERTY actualDate: cal::local_date;
      CREATE PROPERTY estimatedDate: cal::local_date;
      CREATE REQUIRED PROPERTY planned: std::bool {
          SET default := false;
      };
      CREATE ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForCeremony
          ALLOW UPDATE WRITE, DELETE, INSERT ;
      CREATE CONSTRAINT std::exclusive ON (.engagement);
  };
  CREATE TYPE Engagement::CertificationCeremony EXTENDING Engagement::Ceremony;
  CREATE TYPE Engagement::DedicationCeremony EXTENDING Engagement::Ceremony;
  CREATE SCALAR TYPE Ethnologue::code EXTENDING std::str {
      CREATE CONSTRAINT std::regexp('^[a-z]{3}$');
  };
  CREATE TYPE Ethnologue::Language EXTENDING Project::ContextAware {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForEthnologueLanguage
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEthnologueLanguage
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((((EXISTS ((<default::Role>{'Administrator', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.sensitivity <= default::Sensitivity.Medium))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT givenRoles)) AND .isMember)) OR ((default::Role.Fundraising IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Marketing', 'Fundraising', 'ExperienceOperations'} INTERSECT givenRoles)) AND (.sensitivity <= default::Sensitivity.Low)))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForEthnologueLanguage
          ALLOW UPDATE WRITE ;
      CREATE REQUIRED LINK language: default::Language {
          ON TARGET DELETE DELETE SOURCE;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY population: default::population;
      CREATE PROPERTY code: Ethnologue::code {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY name: std::str;
      CREATE PROPERTY provisionalCode: Ethnologue::code {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  CREATE ABSTRACT TYPE Media::Temporal EXTENDING default::Media {
      CREATE REQUIRED PROPERTY duration: std::int32;
  };
  CREATE TYPE Media::Audio EXTENDING Media::Temporal;
  CREATE ABSTRACT TYPE Media::Visual EXTENDING default::Media {
      CREATE REQUIRED PROPERTY dimensions: tuple<width: std::int16, height: std::int16>;
  };
  CREATE TYPE Media::Image EXTENDING Media::Visual;
  CREATE TYPE Media::Video EXTENDING Media::Visual, Media::Temporal;
  ALTER TYPE ProgressReport::Child {
      CREATE REQUIRED LINK report: default::ProgressReport {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
  };
  CREATE TYPE ProgressReport::VarianceExplanation EXTENDING ProgressReport::Child {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForProgressReportVarianceExplanation
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportVarianceExplanation
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT givenRoles)) AND .isMember))
          );
      ALTER LINK report {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProgressReportVarianceExplanation
          ALLOW UPDATE WRITE ;
      CREATE PROPERTY comments: default::RichText;
      CREATE MULTI PROPERTY reasons: std::str;
  };
  ALTER TYPE ProgressReport::CommunityStory {
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportCommunityStory
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember))
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportCommunityStory
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE ProgressReport::Highlight {
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportHighlight
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember))
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportHighlight
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  ALTER TYPE ProgressReport::Media {
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportMedia
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (((((default::Role.Administrator IN givenRoles) OR (((default::Role.FieldPartner IN givenRoles) AND .isMember) AND (<std::str>.variant = 'draft'))) OR ((default::Role.Marketing IN givenRoles) AND (<std::str>.variant = 'published'))) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember) AND (<std::str>.variant IN {'draft', 'translated', 'fpm'}))) OR (((default::Role.Translator IN givenRoles) AND .isMember) AND (<std::str>.variant = 'translated')))
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportMedia
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((((((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT givenRoles)) AND .isMember)) OR (((default::Role.FieldPartner IN givenRoles) AND .isMember) AND (<std::str>.variant = 'draft'))) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND (((.isMember AND (<std::str>.variant IN {'draft', 'translated', 'fpm'})) OR ((.sensitivity <= default::Sensitivity.Low) AND (<std::str>.variant IN {'fpm', 'published'}))) OR .isMember))) OR ((default::Role.Translator IN givenRoles) AND ((.isMember AND (<std::str>.variant = 'translated')) OR .isMember))) OR (.isOwner ?? false))
          );
  };
  ALTER TYPE ProgressReport::TeamNews {
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportTeamNews
          ALLOW INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((default::Role.Administrator IN givenRoles) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember))
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProgressReportTeamNews
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Translator'} INTERSECT givenRoles)) AND .isMember))
          );
  };
  CREATE SCALAR TYPE Product::Step EXTENDING enum<ExegesisAndFirstDraft, TeamCheck, CommunityTesting, BackTranslation, ConsultantCheck, InternalizationAndDrafting, PeerRevision, ConsistencyCheckAndFinalEdits, Craft, Test, `Check`, Record, Develop, Translate, Completed>;
  CREATE SCALAR TYPE ProgressReport::ProductProgress::Variant EXTENDING enum<Official, Partner>;
  CREATE TYPE ProgressReport::ProductProgress::Step EXTENDING Mixin::Timestamped, Project::ContextAware {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForStepProgress
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (default::Role.Administrator IN givenRoles)
          );
      CREATE REQUIRED PROPERTY variant: ProgressReport::ProductProgress::Variant;
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForStepProgress
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((((EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'StaffMember'} INTERSECT givenRoles)) OR (((default::Role.FieldPartner IN givenRoles) AND .isMember) AND (<std::str>.variant = 'partner'))) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember) AND (<std::str>.variant IN {'official', 'partner'}))) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor'} INTERSECT givenRoles)) AND .isMember))
          );
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForStepProgress
          ALLOW UPDATE WRITE ;
      CREATE REQUIRED LINK report: default::ProgressReport;
      CREATE REQUIRED PROPERTY step: Product::Step;
      CREATE PROPERTY completed: std::float32;
  };
  ALTER TYPE Project::Member {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForProjectMember
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND .isMember))
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProjectMember
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} INTERSECT givenRoles)) AND .isMember))
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
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEducation
          ALLOW SELECT, UPDATE READ USING (WITH
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
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForUnavailability
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Intern', 'Mentor'} INTERSECT givenRoles)) AND EXISTS ({'Stubbed .isMember for User/Unavailability'})))
          );
  };
  CREATE SCALAR TYPE Partnership::AgreementStatus EXTENDING enum<NotAttached, AwaitingSignature, Signed>;
  CREATE TYPE default::Partnership EXTENDING Project::Child {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForPartnership
          ALLOW DELETE, INSERT USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              ((EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT givenRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium))))
          );
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPartnership
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (((EXISTS ((<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'Leadership', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT givenRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT givenRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR ((default::Role.StaffMember IN givenRoles) AND (.sensitivity <= default::Sensitivity.Low)))
          );
      CREATE REQUIRED LINK partner: default::Partner;
      CREATE LINK organization := (.partner.organization);
      CREATE LINK agreement: default::File;
      CREATE LINK mou: default::File;
      CREATE CONSTRAINT std::exclusive ON ((.project, .partner));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForPartnership
          ALLOW UPDATE WRITE ;
      CREATE PROPERTY mouEndOverride: cal::local_date;
      CREATE PROPERTY mouEnd := ((.mouEndOverride ?? .project.mouEnd));
      CREATE PROPERTY mouStartOverride: cal::local_date;
      CREATE PROPERTY mouStart := ((.mouStartOverride ?? .project.mouStart));
      CREATE REQUIRED PROPERTY agreementStatus: Partnership::AgreementStatus {
          SET default := (Partnership::AgreementStatus.NotAttached);
      };
      CREATE PROPERTY financialReportingType: Partnership::FinancialReportingType;
      CREATE REQUIRED PROPERTY mouStatus: Partnership::AgreementStatus {
          SET default := (Partnership::AgreementStatus.NotAttached);
      };
      CREATE REQUIRED PROPERTY primary: std::bool {
          SET default := false;
      };
      CREATE MULTI PROPERTY types: Partner::Type;
  };
  CREATE SCALAR TYPE Budget::Status EXTENDING enum<Pending, Current, Superceded, Rejected>;
  CREATE TYPE default::Budget EXTENDING Project::Child {
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForBudget
          ALLOW SELECT, UPDATE READ USING (WITH
              givenRoles := 
                  (<default::User>GLOBAL default::currentUserId).roles
          SELECT
              (EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector'} INTERSECT givenRoles)) OR ((default::Role.ConsultantManager IN givenRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium))))
          );
      CREATE REQUIRED PROPERTY status: Budget::Status {
          SET default := (Budget::Status.Pending);
      };
      CREATE ACCESS POLICY CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForBudget
          ALLOW UPDATE WRITE, DELETE, INSERT ;
      CREATE LINK universalTemplate: default::File;
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
  ALTER TYPE default::LanguageEngagement {
      CREATE REQUIRED LINK language: default::Language {
          SET readonly := true;
      };
  };
  ALTER TYPE default::Language {
      CREATE LINK engagements := (SELECT
          default::LanguageEngagement
      FILTER
          (__source__ = .language)
      );
  };
  ALTER TYPE default::FieldRegion {
      CREATE REQUIRED LINK fieldZone: default::FieldZone;
  };
  ALTER TYPE default::FieldZone {
      CREATE LINK fieldRegions := (.<fieldZone[IS default::FieldRegion]);
  };
  ALTER TYPE default::TranslationProject {
      CREATE MULTI LINK languages := (.engagements.language);
  };
  ALTER TYPE default::Project {
      CREATE LINK partnerships := (.<project[IS default::Partnership]);
      CREATE TRIGGER createBudgetOnInsert
          AFTER INSERT 
          FOR EACH DO (INSERT
              default::Budget
              {
                  createdAt := std::datetime_of_statement(),
                  modifiedAt := std::datetime_of_statement(),
                  project := __new__,
                  projectContext := __new__.projectContext
              });
      CREATE TRIGGER enforceFundingAccount
          AFTER UPDATE 
          FOR EACH DO (std::assert((std::any((__new__.primaryLocation.fundingAccount.accountNumber > 0)) OR NOT (EXISTS (__new__.primaryLocation))), message := 'Project must have a primary location with a specified funding account'));
      CREATE LINK fieldRegion: default::FieldRegion;
      CREATE LINK marketingRegionOverride: default::FieldRegion;
      CREATE LINK marketingLocation: default::Location;
      CREATE MULTI LINK otherLocations: default::Location;
  };
  ALTER TYPE default::TranslationProject {
      CREATE TRIGGER confirmProjectSens
          AFTER UPDATE 
          FOR EACH DO (std::assert((__new__.ownSensitivity = (std::max(__new__.languages.ownSensitivity) ?? default::Sensitivity.High)), message := 'TranslationProject sensitivity is automatically set to (and required to be) the highest sensitivity Language engaged'));
  };
  ALTER TYPE default::Language {
      CREATE LINK projects := (SELECT
          default::TranslationProject
      FILTER
          (__source__ = .languages)
      );
      CREATE TRIGGER recalculateProjectSens
          AFTER UPDATE 
          FOR EACH DO (UPDATE
              (SELECT
                  __new__.projects
              FILTER
                  (.ownSensitivity != (std::max(.languages.ownSensitivity) ?? default::Sensitivity.High))
              )
          SET {
              ownSensitivity := (std::max(.languages.ownSensitivity) ?? default::Sensitivity.High)
          });
      CREATE TRIGGER connectEthnologue
          AFTER INSERT 
          FOR EACH DO (((SELECT
              Ethnologue::Language
          FILTER
              (.language = __new__)
          ) ?? (INSERT
              Ethnologue::Language
              {
                  language := __new__,
                  ownSensitivity := __new__.ownSensitivity,
                  projectContext := __new__.projectContext
              })));
      CREATE REQUIRED SINGLE LINK ethnologue := (std::assert_exists(std::assert_single(.<language[IS Ethnologue::Language])));
      CREATE PROPERTY population := ((.populationOverride ?? .ethnologue.population));
      CREATE TRIGGER matchEthnologueToOwnSens
          AFTER UPDATE 
          FOR EACH DO (UPDATE
              __new__.ethnologue
          FILTER
              (.ownSensitivity != __new__.ownSensitivity)
          SET {
              ownSensitivity := __new__.ownSensitivity
          });
  };
  CREATE SCALAR TYPE Product::Medium EXTENDING enum<Print, Web, EBook, App, TrainedStoryTellers, Audio, Video, Other>;
  CREATE TYPE Product::PartnershipProducingMedium EXTENDING Engagement::Child {
      CREATE REQUIRED LINK partnership: default::Partnership {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY medium: Product::Medium;
      CREATE CONSTRAINT std::exclusive ON ((.engagement, .partnership, .medium));
  };
  CREATE SCALAR TYPE Product::Methodology EXTENDING enum<Paratext, OtherWritten, Render, Audacity, AdobeAudition, OtherOralTranslation, StoryTogether, SeedCompanyMethod, OneStory, Craft2Tell, OtherOralStories, Film, SignLanguage, OtherVisual>;
  CREATE SCALAR TYPE Product::ProgressMeasurement EXTENDING enum<Number, Percent, Boolean>;
  CREATE SCALAR TYPE Product::Purpose EXTENDING enum<EvangelismChurchPlanting, ChurchLife, ChurchMaturity, SocialIssues, Discipleship>;
  CREATE ABSTRACT TYPE default::Product EXTENDING Engagement::Child {
      CREATE PROPERTY describeCompletion: std::str;
      CREATE MULTI PROPERTY mediums: Product::Medium;
      CREATE PROPERTY methodology: Product::Methodology;
      CREATE PROPERTY placeholderDescription: std::str;
      CREATE PROPERTY pnpIndex: std::int16;
      CREATE PROPERTY progressStepMeasurement: Product::ProgressMeasurement;
      CREATE PROPERTY progressTarget: std::int16;
      CREATE MULTI PROPERTY purposes: Product::Purpose;
      CREATE MULTI PROPERTY steps: Product::Step;
  };
  CREATE TYPE default::DerivativeScriptureProduct EXTENDING default::Product {
      CREATE REQUIRED LINK produces: default::Producible;
      CREATE REQUIRED PROPERTY composite: std::bool {
          SET default := false;
      };
      CREATE PROPERTY totalVerseEquivalents: std::float32;
      CREATE PROPERTY totalVerses: std::int16;
  };
  CREATE TYPE Scripture::UnspecifiedPortion {
      CREATE REQUIRED PROPERTY book: std::str {
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY totalVerses: std::int16 {
          SET readonly := true;
          CREATE CONSTRAINT std::min_value(1);
      };
  };
  CREATE TYPE default::DirectScriptureProduct EXTENDING default::Product {
      CREATE LINK unspecifiedScripture: Scripture::UnspecifiedPortion {
          ON SOURCE DELETE DELETE TARGET;
      };
      CREATE TRIGGER deleteOldUnspecifiedScripture
          AFTER UPDATE 
          FOR EACH 
              WHEN ((__old__.unspecifiedScripture ?!= __new__.unspecifiedScripture))
          DO (DELETE
              __old__.unspecifiedScripture
          );
      CREATE PROPERTY totalVerseEquivalents: std::float32;
      CREATE PROPERTY totalVerses: std::int16;
  };
  CREATE TYPE default::OtherProduct EXTENDING default::Product {
      CREATE PROPERTY description: std::str;
      CREATE REQUIRED PROPERTY title: std::str;
  };
  ALTER TYPE default::Post {
      CREATE SINGLE PROPERTY isMember := (.container[IS Project::ContextAware].isMember);
      CREATE SINGLE PROPERTY sensitivity := (.container[IS Project::ContextAware].sensitivity);
  };
  ALTER TYPE Project::Child {
      CREATE TRIGGER enforceCorrectProjectContext
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((__new__.projectContext = __new__.project.projectContext), message := "Given project context must match given project's context"));
  };
  ALTER TYPE Budget::Record {
      CREATE REQUIRED LINK budget: default::Budget {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE CONSTRAINT std::exclusive ON ((.budget, .fiscalYear, .organization));
  };
  ALTER TYPE Engagement::Child {
      CREATE TRIGGER enforceEngagementProject
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((__new__.engagement.project = __new__.project), message := 'Given engagement must be for the same project as the given project.'));
  };
  ALTER TYPE ProgressReport::Child {
      CREATE TRIGGER enforceProgressReportEngagement
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((__new__.report.engagement = __new__.engagement), message := 'Given progress report must be for the same engagement as the given engagement'));
  };
  ALTER TYPE ProgressReport::CommunityStory {
      ALTER LINK container {
          SET OWNED;
          SET TYPE default::ProgressReport USING (<default::ProgressReport>{});
      };
  };
  ALTER TYPE ProgressReport::Highlight {
      ALTER LINK container {
          SET OWNED;
          SET TYPE default::ProgressReport USING (<default::ProgressReport>{});
      };
  };
  ALTER TYPE ProgressReport::TeamNews {
      ALTER LINK container {
          SET OWNED;
          SET TYPE default::ProgressReport USING (<default::ProgressReport>{});
      };
  };
  ALTER TYPE default::Budget {
      CREATE LINK records := (.<budget[IS Budget::Record]);
  };
  ALTER TYPE default::Engagement {
      CREATE REQUIRED SINGLE LINK ceremony := (std::assert_exists(std::assert_single(.<engagement[IS Engagement::Ceremony])));
  };
  ALTER TYPE default::InternshipEngagement {
      CREATE TRIGGER connectCertificationCeremony
          AFTER INSERT 
          FOR EACH DO (INSERT
              Engagement::CertificationCeremony
              {
                  createdAt := std::datetime_of_statement(),
                  modifiedAt := std::datetime_of_statement(),
                  engagement := __new__,
                  project := __new__.project,
                  projectContext := __new__.projectContext
              });
      CREATE CONSTRAINT std::exclusive ON ((.project, .intern));
      CREATE LINK countryOfOrigin: default::Location;
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE TRIGGER connectDedicationCeremony
          AFTER INSERT 
          FOR EACH DO (INSERT
              Engagement::DedicationCeremony
              {
                  createdAt := std::datetime_of_statement(),
                  modifiedAt := std::datetime_of_statement(),
                  engagement := __new__,
                  project := __new__.project,
                  projectContext := __new__.projectContext
              });
      CREATE TRIGGER addProjectToContextOfLanguage
          AFTER INSERT 
          FOR EACH DO (UPDATE
              __new__.language.projectContext
          SET {
              projects += __new__.project
          });
      CREATE TRIGGER removeProjectFromContextOfLanguage
          AFTER DELETE 
          FOR EACH DO (UPDATE
              __old__.language.projectContext
          SET {
              projects -= __old__.project
          });
      CREATE PROPERTY firstScripture := (EXISTS (.language.firstScriptureEngagement));
      CREATE TRIGGER recalculateProjectSensOnDelete
          AFTER DELETE 
          FOR EACH DO (WITH
              removedLang := 
                  __old__.language
          UPDATE
              (SELECT
                  __old__.project
              FILTER
                  (.ownSensitivity != (std::max(((.languages EXCEPT removedLang)).ownSensitivity) ?? default::Sensitivity.High))
              )
          SET {
              ownSensitivity := (std::max(((.languages EXCEPT removedLang)).ownSensitivity) ?? default::Sensitivity.High)
          });
      CREATE TRIGGER recalculateProjectSensOnInsert
          AFTER INSERT 
          FOR EACH DO (UPDATE
              (SELECT
                  __new__.project
              FILTER
                  (.ownSensitivity != (std::max(.languages.ownSensitivity) ?? default::Sensitivity.High))
              )
          SET {
              ownSensitivity := (std::max(.languages.ownSensitivity) ?? default::Sensitivity.High)
          });
      CREATE CONSTRAINT std::exclusive ON ((.project, .language));
  };
  ALTER TYPE default::ProgressReport {
      CREATE SINGLE LINK varianceExplanation := (.<report[IS ProgressReport::VarianceExplanation]);
  };
  CREATE TYPE Auth::EmailToken EXTENDING Mixin::Timestamped {
      CREATE REQUIRED PROPERTY email: std::str;
      CREATE INDEX ON (.email);
      CREATE REQUIRED PROPERTY token: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  CREATE TYPE Auth::Identity {
      CREATE REQUIRED LINK user: default::User {
          ON TARGET DELETE DELETE SOURCE;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED PROPERTY passwordHash: std::str;
  };
  CREATE TYPE Auth::Session EXTENDING Mixin::Timestamped {
      CREATE LINK user: default::User {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED PROPERTY token: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  ALTER TYPE Comments::Comment {
      CREATE REQUIRED LINK thread: Comments::Thread {
          ON TARGET DELETE DELETE SOURCE;
      };
  };
  ALTER TYPE Comments::Thread {
      CREATE LINK comments := (.<thread[IS Comments::Comment]);
      CREATE LINK firstComment := (SELECT
          .comments ORDER BY
              .createdAt ASC
      LIMIT
          1
      );
      CREATE LINK latestComment := (SELECT
          .comments ORDER BY
              .createdAt DESC
      LIMIT
          1
      );
  };
  ALTER TYPE Prompt::PromptVariantResponse {
      CREATE LINK responses := (.<pvr[IS Prompt::VariantResponse]);
  };
  ALTER TYPE ProgressReport::WorkflowEvent {
      CREATE REQUIRED LINK report: default::ProgressReport {
          SET readonly := true;
      };
  };
  ALTER TYPE default::ProgressReport {
      CREATE LINK workflowEvents := (.<report[IS ProgressReport::WorkflowEvent]);
      CREATE LINK latestEvent := (SELECT
          .workflowEvents ORDER BY
              .at DESC
      LIMIT
          1
      );
      CREATE PROPERTY status := ((.latestEvent.status ?? ProgressReport::Status.NotStarted));
  };
  ALTER TYPE ProgressReport::ProductProgress::Step {
      CREATE REQUIRED LINK product: default::Product;
      CREATE CONSTRAINT std::exclusive ON ((.report, .product, .variant, .step));
  };
  CREATE SCALAR TYPE ProgressReport::ProductProgress::Period EXTENDING enum<ReportPeriod, FiscalYearSoFar, Cumulative>;
  CREATE TYPE ProgressReport::ProductProgress::Summary {
      CREATE REQUIRED LINK report: default::ProgressReport;
      CREATE REQUIRED PROPERTY period: ProgressReport::ProductProgress::Period;
      CREATE CONSTRAINT std::exclusive ON ((.report, .period));
      CREATE REQUIRED PROPERTY actual: std::float32;
      CREATE REQUIRED PROPERTY planned: std::float32;
  };
  CREATE TYPE Scripture::Collection {
      CREATE REQUIRED PROPERTY label: std::str {
          SET readonly := true;
      };
  };
  ALTER TYPE default::Product {
      CREATE LINK scripture: Scripture::Collection {
          ON SOURCE DELETE DELETE TARGET;
      };
  };
  ALTER TYPE default::DirectScriptureProduct {
      CREATE TRIGGER deleteOldScripture
          AFTER UPDATE 
          FOR EACH 
              WHEN ((__old__.scripture ?!= __new__.scripture))
          DO (DELETE
              __old__.scripture
          );
  };
  ALTER TYPE default::DerivativeScriptureProduct {
      CREATE LINK scriptureOverride: Scripture::Collection {
          ON SOURCE DELETE DELETE TARGET;
      };
      CREATE TRIGGER deleteOldScriptureOverride
          AFTER UPDATE 
          FOR EACH 
              WHEN ((__old__.scriptureOverride ?!= __new__.scriptureOverride))
          DO (DELETE
              __old__.scriptureOverride
          );
      ALTER LINK scripture {
          ON SOURCE DELETE ALLOW;
          SET OWNED;
      };
  };
  ALTER TYPE default::Producible {
      CREATE LINK scripture: Scripture::Collection {
          ON SOURCE DELETE DELETE TARGET;
      };
      CREATE TRIGGER updateDerivativeProducts
          AFTER UPDATE 
          FOR EACH 
              WHEN ((__old__.scripture ?!= __new__.scripture))
          DO (UPDATE
              default::DerivativeScriptureProduct
          FILTER
              ((.produces = __new__) AND NOT (EXISTS (.scriptureOverride)))
          SET {
              scripture := __new__.scripture
          });
  };
  CREATE TYPE Scripture::VerseRange {
      CREATE REQUIRED PROPERTY label: std::str {
          SET readonly := true;
      };
  };
  ALTER TYPE Scripture::Collection {
      CREATE MULTI LINK verses: Scripture::VerseRange {
          ON SOURCE DELETE DELETE TARGET;
          ON TARGET DELETE DEFERRED RESTRICT;
          SET readonly := true;
      };
  };
  CREATE TYPE Scripture::Verse {
      CREATE REQUIRED PROPERTY verseId: std::int16 {
          SET readonly := true;
          CREATE CONSTRAINT std::expression ON (((__subject__ >= 0) AND (__subject__ <= 31101)));
      };
      CREATE REQUIRED PROPERTY book: std::str {
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY chapter: std::int16 {
          SET readonly := true;
          CREATE CONSTRAINT std::expression ON (((__subject__ >= 1) AND (__subject__ <= 150)));
      };
      CREATE REQUIRED PROPERTY verse: std::int16 {
          SET readonly := true;
          CREATE CONSTRAINT std::expression ON (((__subject__ >= 1) AND (__subject__ <= 176)));
      };
      CREATE PROPERTY label := (((((.book ++ ' ') ++ <std::str>.chapter) ++ ':') ++ <std::str>.verse));
  };
  ALTER TYPE Scripture::VerseRange {
      CREATE REQUIRED LINK `end`: Scripture::Verse {
          ON SOURCE DELETE DELETE TARGET;
          SET readonly := true;
      };
      CREATE REQUIRED LINK `start`: Scripture::Verse {
          ON SOURCE DELETE DELETE TARGET;
          SET readonly := true;
      };
      CREATE PROPERTY ids := (std::range(<std::int32>.`start`.verseId, <std::int32>.`end`.verseId, inc_upper := true));
  };
  ALTER TYPE Scripture::Collection {
      CREATE PROPERTY ids := (std::multirange(std::array_agg(.verses.ids)));
  };
  ALTER TYPE default::DerivativeScriptureProduct {
      ALTER LINK scripture {
          CREATE REWRITE
              INSERT 
              USING ((IF EXISTS (.scriptureOverride) THEN (IF EXISTS (.scriptureOverride.verses) THEN .scriptureOverride ELSE {}) ELSE .produces.scripture));
          CREATE REWRITE
              UPDATE 
              USING ((IF EXISTS (.scriptureOverride) THEN (IF EXISTS (.scriptureOverride.verses) THEN .scriptureOverride ELSE {}) ELSE .produces.scripture));
      };
  };
  ALTER TYPE default::Product {
      CREATE TRIGGER denyEmptyScriptureCollection
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((NOT (EXISTS (__new__.scripture)) OR EXISTS (__new__.scripture.verses)), message := '`Product.scripture` should have a `Scripture::Collection` with verses or be null/empty-set'));
  };
  ALTER TYPE default::Producible {
      CREATE TRIGGER denyEmptyScriptureCollection
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((NOT (EXISTS (__new__.scripture)) OR EXISTS (__new__.scripture.verses)), message := '`Producible.scripture` should have a `Scripture::Collection` with verses or be null/empty-set'));
  };
  CREATE TYPE default::Alias {
      CREATE REQUIRED LINK target: std::Object {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED PROPERTY name: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  CREATE SCALAR TYPE default::Sens EXTENDING default::Sensitivity;
};
