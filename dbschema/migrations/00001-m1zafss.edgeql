CREATE MIGRATION m1zafsshfknkck6a7esom7ck425amgmeqx2pds6zimbvsajhz2ekfq
    ONTO initial
{
  CREATE MODULE Auth IF NOT EXISTS;
  CREATE MODULE Engagement IF NOT EXISTS;
  CREATE MODULE Ethnologue IF NOT EXISTS;
  CREATE MODULE File IF NOT EXISTS;
  CREATE MODULE Location IF NOT EXISTS;
  CREATE MODULE Mixin IF NOT EXISTS;
  CREATE MODULE Product IF NOT EXISTS;
  CREATE MODULE Project IF NOT EXISTS;
  CREATE MODULE User IF NOT EXISTS;
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
  CREATE GLOBAL default::currentActorId -> std::uuid;
  CREATE SCALAR TYPE default::Role EXTENDING enum<Administrator, BetaTester, BibleTranslationLiaison, Consultant, ConsultantManager, Controller, ExperienceOperations, FieldOperationsDirector, FieldPartner, FinancialAnalyst, Fundraising, Intern, LeadFinancialAnalyst, Leadership, Liaison, Marketing, Mentor, ProjectManager, RegionalCommunicationsCoordinator, RegionalDirector, StaffMember, Translator>;
  CREATE ABSTRACT TYPE default::Actor {
      CREATE MULTI PROPERTY roles: default::Role;
  };
  CREATE GLOBAL default::currentActor := (SELECT
      default::Actor
  FILTER
      (.id = GLOBAL default::currentActorId)
  );
  CREATE ABSTRACT TYPE Mixin::Named {
      CREATE REQUIRED PROPERTY name: std::str;
      CREATE INDEX fts::index ON (fts::with_options(.name, language := fts::Language.eng));
  };
  CREATE ABSTRACT TYPE Mixin::Taggable {
      CREATE MULTI PROPERTY tags: std::str;
  };
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
  CREATE SCALAR TYPE Project::Type EXTENDING enum<MomentumTranslation, MultiplicationTranslation, Internship>;
  CREATE SCALAR TYPE default::ReportPeriod EXTENDING enum<Monthly, Quarterly>;
  CREATE SCALAR TYPE default::Sensitivity EXTENDING enum<Low, Medium, High>;
  CREATE ABSTRACT TYPE Mixin::Audited EXTENDING Mixin::Timestamped {
      CREATE REQUIRED LINK createdBy: default::Actor {
          SET default := (GLOBAL default::currentActor);
          SET readonly := true;
      };
      CREATE REQUIRED LINK modifiedBy: default::Actor {
          SET default := (GLOBAL default::currentActor);
          CREATE REWRITE
              UPDATE 
              USING (GLOBAL default::currentActor);
      };
      CREATE REQUIRED PROPERTY isCreator := ((.createdBy ?= GLOBAL default::currentActor));
  };
  CREATE ABSTRACT TYPE Mixin::Pinnable;
  CREATE ABSTRACT TYPE Project::ContextAware {
      CREATE OPTIONAL PROPERTY ownSensitivity: default::Sensitivity {
          CREATE ANNOTATION std::description := "A writable source of a sensitivity. This doesn't necessarily mean it be the same as .sensitivity, which is what is used for authorization.";
      };
      CREATE ANNOTATION std::description := 'A type that has a project context, which allows it to be\n      aware of the sensitivity & current user membership for the associated context.';
  };
  CREATE ABSTRACT TYPE default::Resource EXTENDING Mixin::Audited;
  CREATE ABSTRACT TYPE default::Project EXTENDING default::Resource, Project::ContextAware, Mixin::Named, Mixin::Pinnable, Mixin::Taggable {
      CREATE REQUIRED PROPERTY step: Project::Step {
          SET default := (Project::Step.EarlyConversations);
      };
      CREATE PROPERTY status := (Project::statusFromStep(.step));
      ALTER PROPERTY ownSensitivity {
          SET default := (default::Sensitivity.High);
          SET OWNED;
          SET REQUIRED;
          SET TYPE default::Sensitivity;
          CREATE ANNOTATION std::description := 'The sensitivity of the project. This is user settable for internships and calculated for translation projects';
      };
      CREATE PROPERTY departmentId: std::str {
          CREATE CONSTRAINT std::exclusive;
          CREATE CONSTRAINT std::expression ON (((<std::int32>__subject__ > 0) AND (std::len(__subject__) = 5)));
      };
      CREATE PROPERTY estimatedSubmission: cal::local_date;
      CREATE PROPERTY financialReportPeriod: default::ReportPeriod;
      CREATE PROPERTY financialReportReceivedAt: std::datetime;
      CREATE PROPERTY mouEnd: cal::local_date;
      CREATE PROPERTY initialMouEnd: cal::local_date {
          SET default := (.mouEnd);
          CREATE REWRITE
              UPDATE 
              USING ((.mouEnd IF (.status = Project::Status.InDevelopment) ELSE .initialMouEnd));
      };
      CREATE PROPERTY mouStart: cal::local_date;
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY type := (<Project::Type>(.__type__.name)[9:-7]);
      CREATE CONSTRAINT std::expression ON ((.mouEnd >= .mouStart));
  };
  CREATE TYPE default::InternshipProject EXTENDING default::Project;
  CREATE TYPE Project::Context {
      CREATE MULTI LINK projects: default::Project {
          ON TARGET DELETE ALLOW;
      };
      CREATE ANNOTATION std::description := 'A type that holds a reference to a list of projects. This allows multiple objects to hold a reference to the same list. For example, Language & Ethnologue::Language share the same context / project list.';
  };
  ALTER TYPE Project::ContextAware {
      CREATE REQUIRED LINK projectContext: Project::Context {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED SINGLE PROPERTY sensitivity := ((std::max(.projectContext.projects.ownSensitivity) ?? (.ownSensitivity ?? default::Sensitivity.High)));
  };
  ALTER TYPE default::Project {
      ALTER LINK projectContext {
          SET default := (INSERT
              Project::Context
          );
          ON SOURCE DELETE DELETE TARGET;
          SET OWNED;
          SET TYPE Project::Context;
      };
  };
  CREATE ABSTRACT TYPE default::TranslationProject EXTENDING default::Project;
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
                  info := 
                      (IF (__subject__ IS default::MultiplicationTranslationProject) THEN (
                          prefix := 8,
                          startingOffset := 201
                      ) ELSE (
                          prefix := (std::assert_exists(__subject__.primaryLocation.fundingAccount, message := 'Project must have a primary location')).accountNumber,
                          startingOffset := 11
                      ))
              SELECT
                  std::min((<std::str>std::range_unpack(std::range(((info.prefix * 10000) + info.startingOffset), ((info.prefix * 10000) + 9999))) EXCEPT (DETACHED default::Project).departmentId))
              ) ELSE .departmentId));
          CREATE REWRITE
              UPDATE 
              USING ((IF ((NOT (EXISTS (.departmentId)) AND (.status <= Project::Status.Active)) AND (.step >= Project::Step.PendingFinanceConfirmation)) THEN (WITH
                  info := 
                      (IF (__subject__ IS default::MultiplicationTranslationProject) THEN (
                          prefix := 8,
                          startingOffset := 201
                      ) ELSE (
                          prefix := (std::assert_exists(__subject__.primaryLocation.fundingAccount, message := 'Project must have a primary location')).accountNumber,
                          startingOffset := 11
                      ))
              SELECT
                  std::min((<std::str>std::range_unpack(std::range(((info.prefix * 10000) + info.startingOffset), ((info.prefix * 10000) + 9999))) EXCEPT (DETACHED default::Project).departmentId))
              ) ELSE .departmentId));
      };
  };
  CREATE FUNCTION default::date_range_get_upper(period: range<cal::local_date>) ->  cal::local_date USING ((<cal::local_date><std::str>std::assert_exists(std::range_get_upper(period)) - <cal::date_duration>'1 day'));
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
  CREATE ABSTRACT TYPE File::Node EXTENDING default::Resource, Mixin::Named {
      CREATE LINK parent: File::Node;
      CREATE MULTI LINK parents: File::Node {
          CREATE PROPERTY depth: std::int16;
      };
      CREATE PROPERTY public: std::bool;
      CREATE REQUIRED PROPERTY size: std::int64;
  };
  ALTER TYPE Mixin::Named {
      CREATE INDEX ON (default::str_sortable(.name));
  };
  CREATE TYPE File::Version EXTENDING File::Node {
      CREATE REQUIRED PROPERTY mimeType: std::str;
  };
  CREATE TYPE default::Directory EXTENDING File::Node {
      CREATE REQUIRED PROPERTY totalFiles: std::int32 {
          SET default := 0;
      };
  };
  CREATE TYPE default::File EXTENDING File::Node {
      CREATE REQUIRED LINK latestVersion: File::Version;
      CREATE REQUIRED PROPERTY mimeType: std::str;
  };
  CREATE SCALAR TYPE default::population EXTENDING std::int32 {
      CREATE CONSTRAINT std::expression ON ((__subject__ >= 0));
  };
  CREATE TYPE default::Language EXTENDING default::Resource, Project::ContextAware, Mixin::Named, Mixin::Pinnable, Mixin::Taggable {
      ALTER LINK projectContext {
          SET default := (INSERT
              Project::Context
          );
          ON SOURCE DELETE DELETE TARGET;
          SET OWNED;
          SET TYPE Project::Context;
      };
      ALTER PROPERTY ownSensitivity {
          SET default := (default::Sensitivity.High);
          SET OWNED;
          SET REQUIRED;
          SET TYPE default::Sensitivity;
          CREATE ANNOTATION std::description := 'The sensitivity of the language. This is a source / user settable.';
      };
      CREATE PROPERTY populationOverride: default::population;
      CREATE REQUIRED PROPERTY hasExternalFirstScripture: std::bool {
          SET default := false;
      };
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
      CREATE MULTI LINK locations: default::Location;
      CREATE REQUIRED PROPERTY displayName: std::str {
          SET default := (.name);
      };
      CREATE PROPERTY displayNamePronunciation: std::str;
      CREATE PROPERTY leastOfTheseReason: std::str;
      CREATE PROPERTY registryOfLanguageVarietiesCode: std::str {
          CREATE CONSTRAINT std::exclusive;
          CREATE CONSTRAINT std::regexp('^[0-9]{5}$');
      };
      CREATE PROPERTY signLanguageCode: std::str {
          CREATE CONSTRAINT std::regexp(r'^[A-Z]{2}\d{2}$');
      };
      CREATE PROPERTY sponsorEstimatedEndDate: cal::local_date;
  };
  ALTER TYPE default::Location {
      CREATE LINK mapImage: default::File;
  };
  CREATE TYPE default::SystemAgent EXTENDING default::Actor, Mixin::Named {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
  };
  CREATE GLOBAL default::currentRoles := ((GLOBAL default::currentActor).roles);
  CREATE ABSTRACT TYPE Project::Child EXTENDING default::Resource, Project::ContextAware {
      CREATE REQUIRED LINK project: default::Project {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE TRIGGER enforceCorrectProjectContext
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((__new__.projectContext = __new__.project.projectContext), message := "Given project context must match given project's context"));
      CREATE ANNOTATION std::description := 'A type that is a child of a project. It will always have a reference to a single project that it is under.';
  };
  CREATE ABSTRACT TYPE Engagement::Child EXTENDING Project::Child {
      CREATE ANNOTATION std::description := 'A type that is a child of an engagement. It will always have a reference to a single engagement & project that it is under.';
  };
  CREATE ABSTRACT TYPE Engagement::Ceremony EXTENDING Engagement::Child {
      CREATE PROPERTY actualDate: cal::local_date;
      CREATE PROPERTY estimatedDate: cal::local_date;
      CREATE REQUIRED PROPERTY planned: std::bool {
          SET default := false;
      };
  };
  CREATE TYPE Engagement::CertificationCeremony EXTENDING Engagement::Ceremony;
  CREATE TYPE Engagement::DedicationCeremony EXTENDING Engagement::Ceremony;
  CREATE SCALAR TYPE Engagement::InternPosition EXTENDING enum<ConsultantInTraining, MidLevelQualityAssurance, LeadershipDevelopment, Mobilization, Personnel, Communication, Administration, Technology, Finance, LanguageProgramManager, Literacy, OralityFacilitator, ScriptureEngagement, OtherAttached, OtherTranslationCapacity, OtherPartnershipCapacity, ExegeticalFacilitator, TranslationFacilitator>;
  CREATE SCALAR TYPE Engagement::Status EXTENDING enum<InDevelopment, DidNotDevelop, Rejected, Active, DiscussingTermination, DiscussingReactivation, DiscussingChangeToPlan, DiscussingSuspension, FinalizingCompletion, ActiveChangedPlan, Suspended, Terminated, Completed, Converted, Unapproved, Transferred, NotRenewed>;
  CREATE SCALAR TYPE Product::Methodology EXTENDING enum<Paratext, OtherWritten, Render, Audacity, AdobeAudition, OtherOralTranslation, StoryTogether, SeedCompanyMethod, OneStory, Craft2Tell, OtherOralStories, Film, SignLanguage, OtherVisual>;
  CREATE SCALAR TYPE default::RichText EXTENDING std::json;
  CREATE ABSTRACT TYPE default::Engagement EXTENDING Project::Child {
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
  CREATE TYPE default::InternshipEngagement EXTENDING default::Engagement {
      ALTER LINK project {
          SET OWNED;
          SET REQUIRED;
          SET TYPE default::InternshipProject USING (<default::InternshipProject>{});
      };
      CREATE LINK growthPlan: default::File;
      CREATE LINK countryOfOrigin: default::Location;
      CREATE MULTI PROPERTY methodologies: Product::Methodology;
      CREATE PROPERTY position: Engagement::InternPosition;
  };
  CREATE TYPE User::Unavailability EXTENDING default::Resource {
      CREATE REQUIRED PROPERTY dates: range<std::datetime>;
      CREATE PROPERTY `end` := (std::assert_exists(std::range_get_upper(.dates)));
      CREATE PROPERTY `start` := (std::assert_exists(std::range_get_lower(.dates)));
      CREATE REQUIRED PROPERTY description: std::str;
  };
  CREATE SCALAR TYPE User::Status EXTENDING enum<Active, Disabled>;
  CREATE TYPE default::User EXTENDING default::Resource, default::Actor, Mixin::Pinnable {
      CREATE MULTI LINK pins: Mixin::Pinnable {
          ON TARGET DELETE ALLOW;
      };
      CREATE MULTI LINK unavailabilities: User::Unavailability {
          ON SOURCE DELETE DELETE TARGET;
          ON TARGET DELETE ALLOW;
      };
      CREATE MULTI LINK locations: default::Location;
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
      CREATE REQUIRED PROPERTY status: User::Status {
          SET default := (User::Status.Active);
      };
      CREATE REQUIRED PROPERTY timezone: std::str {
          SET default := 'America/Chicago';
      };
      CREATE PROPERTY title: std::str;
  };
  CREATE SCALAR TYPE User::Degree EXTENDING enum<Primary, Secondary, Associates, Bachelors, Masters, Doctorate>;
  CREATE TYPE User::Education EXTENDING default::Resource {
      CREATE REQUIRED PROPERTY degree: User::Degree;
      CREATE REQUIRED PROPERTY institution: std::str;
      CREATE REQUIRED PROPERTY major: std::str;
  };
  CREATE GLOBAL default::currentUser := (SELECT
      default::User
  FILTER
      (.id = GLOBAL default::currentActorId)
  );
  CREATE TYPE Project::Member EXTENDING Project::Child {
      CREATE REQUIRED LINK user: default::User {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE CONSTRAINT std::exclusive ON ((.project, .user));
      CREATE MULTI PROPERTY roles: default::Role;
  };
  ALTER TYPE Engagement::Child {
      CREATE REQUIRED LINK engagement: default::Engagement {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
  };
  ALTER TYPE default::Project {
      CREATE MULTI LINK members := (.<project[IS Project::Member]);
      CREATE SINGLE LINK membership := (SELECT
          .members FILTER
              (.user = GLOBAL default::currentUser)
      LIMIT
          1
      );
  };
  ALTER TYPE Project::ContextAware {
      CREATE REQUIRED SINGLE PROPERTY isMember := (EXISTS (.projectContext.projects.membership));
      CREATE INDEX ON (.projectContext);
  };
  ALTER TYPE default::Engagement {
      CREATE REQUIRED SINGLE LINK ceremony := (std::assert_exists(std::assert_single(.<engagement[IS Engagement::Ceremony])));
  };
  CREATE TYPE default::LanguageEngagement EXTENDING default::Engagement {
      ALTER LINK project {
          SET OWNED;
          SET REQUIRED;
          SET TYPE default::TranslationProject USING (<default::TranslationProject>{});
      };
      CREATE REQUIRED LINK language: default::Language {
          SET readonly := true;
      };
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
      CREATE LINK pnp: default::File;
      CREATE CONSTRAINT std::exclusive ON ((.project, .language));
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
  ALTER TYPE default::InternshipEngagement {
      CREATE TRIGGER connectCertificationCeremony
          AFTER INSERT 
          FOR EACH DO (INSERT
              Engagement::CertificationCeremony
              {
                  createdAt := std::datetime_of_statement(),
                  modifiedAt := std::datetime_of_statement(),
                  createdBy := std::assert_exists(GLOBAL default::currentActor),
                  modifiedBy := std::assert_exists(GLOBAL default::currentActor),
                  engagement := __new__,
                  project := __new__.project,
                  projectContext := __new__.projectContext
              });
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE TRIGGER connectDedicationCeremony
          AFTER INSERT 
          FOR EACH DO (INSERT
              Engagement::DedicationCeremony
              {
                  createdAt := std::datetime_of_statement(),
                  modifiedAt := std::datetime_of_statement(),
                  createdBy := std::assert_exists(GLOBAL default::currentActor),
                  modifiedBy := std::assert_exists(GLOBAL default::currentActor),
                  engagement := __new__,
                  project := __new__.project,
                  projectContext := __new__.projectContext
              });
  };
  ALTER TYPE Engagement::Child {
      CREATE TRIGGER enforceEngagementProject
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((__new__.engagement.project = __new__.project), message := 'Given engagement must be for the same project as the given project.'));
  };
  ALTER TYPE Engagement::Ceremony {
      CREATE CONSTRAINT std::exclusive ON (.engagement);
  };
  CREATE SCALAR TYPE Ethnologue::code EXTENDING std::str {
      CREATE CONSTRAINT std::regexp('^[a-z]{3}$');
  };
  CREATE TYPE Ethnologue::Language EXTENDING Project::ContextAware {
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
  ALTER TYPE Mixin::Pinnable {
      CREATE PROPERTY pinned := (WITH
          user := 
              (SELECT
                  default::User
              FILTER
                  (.id = GLOBAL default::currentActorId)
              )
      SELECT
          (__source__ IN user.pins)
      );
  };
  ALTER TYPE default::Project {
      CREATE LINK rootDirectory: default::Directory;
      CREATE PROPERTY engagementTotal := (std::count(.<project[IS default::Engagement]));
      CREATE TRIGGER enforceFundingAccount
          AFTER UPDATE 
          FOR EACH DO (std::assert((std::any((__new__.primaryLocation.fundingAccount.accountNumber > 0)) OR NOT (EXISTS (__new__.primaryLocation))), message := 'Project must have a primary location with a specified funding account'));
      CREATE LINK marketingLocation: default::Location;
      CREATE MULTI LINK otherLocations: default::Location;
  };
  ALTER TYPE default::InternshipProject {
      CREATE MULTI LINK engagements := (.<project[IS default::InternshipEngagement]);
  };
  ALTER TYPE default::Language {
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
      CREATE OPTIONAL LINK firstScriptureEngagement: default::LanguageEngagement;
      CREATE CONSTRAINT std::expression ON (((EXISTS (.firstScriptureEngagement) AND NOT (.hasExternalFirstScripture)) OR NOT (EXISTS (.firstScriptureEngagement))));
      CREATE LINK engagements := (SELECT
          default::LanguageEngagement
      FILTER
          (__source__ = .language)
      );
  };
  ALTER TYPE default::TranslationProject {
      CREATE MULTI LINK engagements := (.<project[IS default::LanguageEngagement]);
      CREATE MULTI LINK languages := (.engagements.language);
      CREATE TRIGGER confirmProjectSens
          AFTER UPDATE 
          FOR EACH DO (std::assert((__new__.ownSensitivity = (std::max(__new__.languages.ownSensitivity) ?? default::Sensitivity.High)), message := 'TranslationProject sensitivity is automatically set to (and required to be) the highest sensitivity Language engaged'));
  };
  ALTER TYPE default::User {
      CREATE MULTI LINK education: User::Education {
          ON SOURCE DELETE DELETE TARGET;
          ON TARGET DELETE ALLOW;
      };
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
  CREATE ABSTRACT TYPE Mixin::Embedded {
      CREATE REQUIRED SINGLE LINK container: default::Resource;
  };
  ALTER TYPE default::InternshipEngagement {
      CREATE REQUIRED LINK intern: default::User {
          SET readonly := true;
      };
      CREATE CONSTRAINT std::exclusive ON ((.project, .intern));
      CREATE LINK mentor: default::User;
  };
  CREATE TYPE Project::FinancialApprover {
      CREATE REQUIRED LINK user: default::User {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED MULTI PROPERTY projectTypes: Project::Type;
  };
  CREATE TYPE default::Alias {
      CREATE REQUIRED LINK target: std::Object {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED PROPERTY name: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
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
  };
  ALTER TYPE default::LanguageEngagement {
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
  };
  CREATE SCALAR TYPE default::Sens EXTENDING default::Sensitivity;
  CREATE SCALAR TYPE default::nanoid EXTENDING std::str;
};
