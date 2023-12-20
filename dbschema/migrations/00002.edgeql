CREATE MIGRATION m1m7pnl7vcffolzatfunjjqjdbdzezj6tl3u6zqp3zdtwmx54rtlpa
    ONTO m1tuxy6kzs7grrv24yelgcujny4voaabiynfcyvlqelzxzrbs2gwxq
{
  CREATE MODULE Engagement IF NOT EXISTS;
  CREATE MODULE Ethnologue IF NOT EXISTS;
  CREATE MODULE Mixin IF NOT EXISTS;
  CREATE MODULE Project IF NOT EXISTS;
  CREATE MODULE User IF NOT EXISTS;
  DROP ALIAS default::RootUser;
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
  CREATE ABSTRACT TYPE Mixin::Taggable {
      CREATE MULTI PROPERTY tags: std::str;
  };
  CREATE SCALAR TYPE default::ReportPeriod EXTENDING enum<Monthly, Quarterly>;
  CREATE SCALAR TYPE default::Sensitivity EXTENDING enum<Low, Medium, High>;
  CREATE ABSTRACT TYPE Mixin::Pinnable;
  CREATE ABSTRACT TYPE default::Project EXTENDING default::Resource, Mixin::Pinnable, Mixin::Taggable {
      CREATE REQUIRED PROPERTY step: Project::Step {
          SET default := (Project::Step.EarlyConversations);
      };
      CREATE PROPERTY status := (Project::statusFromStep(.step));
      CREATE PROPERTY departmentId: std::str;
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
      CREATE REQUIRED PROPERTY name: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED PROPERTY presetInventory: std::bool {
          SET default := false;
      };
      CREATE REQUIRED PROPERTY sensitivity: default::Sensitivity {
          SET default := (default::Sensitivity.High);
          CREATE ANNOTATION std::description := 'The sensitivity of the project. This is user settable for internships and calculated for translation projects';
      };
      CREATE REQUIRED PROPERTY stepChangedAt: std::datetime {
          SET default := (.createdAt);
          CREATE REWRITE
              UPDATE
              USING ((std::datetime_of_statement() IF (.step != __old__.step) ELSE .stepChangedAt));
      };
      CREATE CONSTRAINT std::expression ON ((.mouEnd >= .mouStart));
  };
  CREATE TYPE default::InternshipProject EXTENDING default::Project;
  CREATE SCALAR TYPE Ethnologue::code EXTENDING std::str {
      CREATE CONSTRAINT std::regexp('^[a-z]{3}$');
  };
  CREATE SCALAR TYPE default::population EXTENDING std::int32 {
      CREATE CONSTRAINT std::min_value(0);
  };
  CREATE TYPE Ethnologue::Language {
      CREATE PROPERTY population: default::population;
      CREATE PROPERTY code: Ethnologue::code {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY name: std::str;
      CREATE PROPERTY provisionalCode: Ethnologue::code {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  CREATE TYPE default::TranslationProject EXTENDING default::Project;
  CREATE TYPE default::Language EXTENDING default::Resource, Mixin::Pinnable, Mixin::Taggable {
      CREATE REQUIRED PROPERTY sensitivity: default::Sensitivity {
          SET default := (default::Sensitivity.High);
          CREATE ANNOTATION std::description := 'The sensitivity of the language. This is a source / user settable.';
      };
      CREATE REQUIRED LINK ethnologue: Ethnologue::Language {
          SET default := (INSERT
              Ethnologue::Language
          );
          ON SOURCE DELETE DELETE TARGET;
      };
      CREATE PROPERTY populationOverride: default::population;
      CREATE PROPERTY population := ((.populationOverride ?? .ethnologue.population));
      CREATE REQUIRED PROPERTY hasExternalFirstScripture: std::bool {
          SET default := false;
      };
      CREATE REQUIRED PROPERTY name: std::str;
      CREATE REQUIRED PROPERTY displayName: std::str {
          SET default := (.name);
      };
      CREATE PROPERTY displayNamePronunciation: std::str;
      CREATE REQUIRED PROPERTY isDialect: std::bool {
          SET default := false;
      };
      CREATE REQUIRED PROPERTY isSignLanguage: std::bool {
          SET default := false;
      };
      CREATE REQUIRED PROPERTY leastOfThese: std::bool {
          SET default := false;
      };
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
  CREATE SCALAR TYPE Engagement::Status EXTENDING enum<InDevelopment, DidNotDevelop, Rejected, Active, DiscussingTermination, DiscussingReactivation, DiscussingChangeToPlan, DiscussingSuspension, FinalizingCompletion, ActiveChangedPlan, Suspended, Terminated, Completed, Converted, Unapproved, Transferred, NotRenewed>;
  CREATE ABSTRACT TYPE Project::Resource EXTENDING default::Resource {
      CREATE REQUIRED LINK project: default::Project {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE PROPERTY sensitivity := (.project.sensitivity);
  };
  CREATE ABSTRACT TYPE default::Engagement EXTENDING Project::Resource {
      CREATE PROPERTY completedDate: cal::local_date {
          CREATE ANNOTATION std::description := 'Translation / Growth Plan complete date';
      };
      CREATE PROPERTY description: std::json;
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
  CREATE TYPE default::LanguageEngagement EXTENDING default::Engagement {
      CREATE REQUIRED LINK language: default::Language {
          SET readonly := true;
      };
      ALTER LINK project {
          SET OWNED;
          SET REQUIRED;
          SET TYPE default::TranslationProject USING (<default::TranslationProject>{});
      };
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
  ALTER TYPE default::TranslationProject {
      CREATE MULTI LINK engagements := (.<project[IS default::LanguageEngagement]);
      CREATE MULTI LINK languages := (.engagements.language);
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE TRIGGER recalculateProjectSensOnDelete
          AFTER DELETE
          FOR EACH DO (WITH
              removedLang :=
                  __old__.language
          UPDATE
              (SELECT
                  __old__.project
              FILTER
                  (.sensitivity != (std::max(((.languages EXCEPT removedLang)).sensitivity) ?? default::Sensitivity.High))
              )
          SET {
              sensitivity := (std::max(((.languages EXCEPT removedLang)).sensitivity) ?? default::Sensitivity.High)
          });
      CREATE TRIGGER recalculateProjectSensOnInsert
          AFTER INSERT
          FOR EACH DO (UPDATE
              (SELECT
                  __new__.project
              FILTER
                  (.sensitivity != (std::max(.languages.sensitivity) ?? default::Sensitivity.High))
              )
          SET {
              sensitivity := (std::max(.languages.sensitivity) ?? default::Sensitivity.High)
          });
  };
  CREATE ABSTRACT TYPE Engagement::Resource EXTENDING Project::Resource {
      CREATE REQUIRED LINK engagement: default::Engagement {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
  };
  CREATE ABSTRACT TYPE Engagement::Ceremony EXTENDING Engagement::Resource {
      CREATE CONSTRAINT std::exclusive ON (.engagement);
      CREATE PROPERTY actualDate: cal::local_date;
      CREATE PROPERTY estimatedDate: cal::local_date;
      CREATE REQUIRED PROPERTY planned: std::bool {
          SET default := false;
      };
      CREATE TRIGGER prohibitDelete
          AFTER DELETE
          FOR EACH DO (std::assert(NOT (EXISTS (__old__.engagement)), message := 'Cannot delete ceremony while engagement still exists.'));
  };
  CREATE TYPE Engagement::CertificationCeremony EXTENDING Engagement::Ceremony;
  CREATE TYPE Engagement::DedicationCeremony EXTENDING Engagement::Ceremony;
  ALTER TYPE default::Engagement {
      CREATE REQUIRED SINGLE LINK ceremony := (std::assert_exists(std::assert_single(.<engagement[IS Engagement::Ceremony])));
  };
  CREATE TYPE default::InternshipEngagement EXTENDING default::Engagement {
      ALTER LINK project {
          SET OWNED;
          SET REQUIRED;
          SET TYPE default::InternshipProject USING (<default::InternshipProject>{});
      };
      CREATE TRIGGER connectCertificationCeremony
          AFTER INSERT
          FOR EACH DO (INSERT
              Engagement::CertificationCeremony
              {
                  createdAt := std::datetime_of_statement(),
                  engagement := __new__,
                  project := __new__.project
              });
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE TRIGGER connectDedicationCeremony
          AFTER INSERT
          FOR EACH DO (INSERT
              Engagement::DedicationCeremony
              {
                  createdAt := std::datetime_of_statement(),
                  engagement := __new__,
                  project := __new__.project
              });
  };
  CREATE TYPE Project::Member EXTENDING Project::Resource {
      CREATE MULTI PROPERTY roles: default::Role;
  };
  ALTER SCALAR TYPE default::UserStatus RENAME TO User::Status;
  CREATE ABSTRACT TYPE Mixin::Owned;
  ALTER TYPE default::User EXTENDING Mixin::Pinnable,
  Mixin::Owned LAST;
  ALTER TYPE Project::Member {
      CREATE REQUIRED LINK user: default::User {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
          SET REQUIRED USING (<default::User>{});
      };
      CREATE CONSTRAINT std::exclusive ON ((.project, .user));
  };
  ALTER TYPE default::Project {
      CREATE MULTI LINK members := (.<project[IS Project::Member]);
      CREATE SINGLE LINK membership := (SELECT
          .members FILTER
              (.user.id = GLOBAL default::currentUserId)
      LIMIT
          1
      );
      CREATE PROPERTY isMember := (EXISTS (.membership));
  };
  ALTER TYPE Project::Resource {
      CREATE PROPERTY isMember := (.project.isMember);
  };
  ALTER TYPE Mixin::Owned {
      CREATE LINK owner: default::User {
          SET default := (<default::User>GLOBAL default::currentUserId);
      };
      CREATE PROPERTY isOwner := ((.owner = <default::User>GLOBAL default::currentUserId));
  };
  ALTER TYPE default::User {
      CREATE MULTI LINK pins: Mixin::Pinnable {
          ON TARGET DELETE ALLOW;
      };
  };
  ALTER TYPE Mixin::Pinnable {
      CREATE PROPERTY pinned := ((__source__ IN (<default::User>GLOBAL default::currentUserId).pins));
  };
  ALTER TYPE default::Project {
      CREATE PROPERTY engagementTotal := (std::count(.<project[IS default::Engagement]));
  };
  ALTER TYPE default::InternshipProject {
      CREATE MULTI LINK engagements := (.<project[IS default::InternshipEngagement]);
  };
  ALTER TYPE default::Language {
      CREATE OPTIONAL LINK firstScriptureEngagement: default::LanguageEngagement;
      CREATE CONSTRAINT std::expression ON (((EXISTS (.firstScriptureEngagement) AND NOT (.hasExternalFirstScripture)) OR NOT (EXISTS (.firstScriptureEngagement))));
      CREATE MULTI LINK engagements := (SELECT
          default::LanguageEngagement
      FILTER
          (__source__ = .language)
      );
      CREATE MULTI LINK projects := (.engagements.project);
      CREATE PROPERTY effectiveSensitivity := ((std::max(.projects.sensitivity) ?? .sensitivity));
  };
  ALTER TYPE default::TranslationProject {
      CREATE TRIGGER confirmProjectSens
          AFTER UPDATE
          FOR EACH DO (std::assert((__new__.sensitivity = (std::max(__new__.languages.sensitivity) ?? default::Sensitivity.High)), message := 'TranslationProject sensitivity is automatically set to (and required to be) the highest sensitivity Language engaged'));
  };
  ALTER TYPE default::InternshipEngagement {
      CREATE REQUIRED LINK intern: default::User {
          SET readonly := true;
          SET REQUIRED USING (<default::User>{});
      };
      CREATE CONSTRAINT std::exclusive ON ((.project, .intern));
      CREATE LINK mentor: default::User;
  };
  ALTER TYPE default::Language {
      CREATE PROPERTY isMember := (EXISTS (.projects.isMember));
      CREATE TRIGGER recalculateProjectSens
          AFTER UPDATE
          FOR EACH DO (UPDATE
              (SELECT
                  __new__.projects
              FILTER
                  (.sensitivity != (std::max(.languages.sensitivity) ?? default::Sensitivity.High))
              )
          SET {
              sensitivity := (std::max(.languages.sensitivity) ?? default::Sensitivity.High)
          });
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE PROPERTY firstScripture := (EXISTS (.language.firstScriptureEngagement));
  };
  CREATE SCALAR TYPE default::Sens EXTENDING default::Sensitivity;
  CREATE ALIAS default::RootUser := (
      SELECT
          default::User
      FILTER
          (.email = 'devops@tsco.org')
  );
};
