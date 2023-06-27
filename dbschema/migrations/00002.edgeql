CREATE MIGRATION m1zdmmvwxtqsw7qjc3o2rjwtlzjpzvy44rouzt5iii5b4ifvfieoha
    ONTO m1a2sjawhkocczaahomg5inph7oitcdwjmxnkb5km774gb75c4ixya
{
  CREATE MODULE Engagement IF NOT EXISTS;
  CREATE MODULE Ethnologue IF NOT EXISTS;
  CREATE MODULE Project IF NOT EXISTS;
  DROP ALIAS default::currentUser;
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
  ALTER TYPE default::Resource {
      ALTER PROPERTY modifiedAt {
          SET default := (std::datetime_of_statement());
          DROP REWRITE
              INSERT ;
          };
      };
  CREATE ABSTRACT TYPE default::Taggable {
      CREATE MULTI PROPERTY tags: std::str;
  };
  CREATE SCALAR TYPE default::ReportPeriod EXTENDING enum<Monthly, Quarterly>;
  CREATE SCALAR TYPE default::Sensitivity EXTENDING enum<Low, Medium, High>;
  CREATE ABSTRACT TYPE default::Pinnable;
  ALTER TYPE default::User {
      EXTENDING default::Pinnable LAST;
      CREATE MULTI LINK pins: default::Pinnable {
          ON TARGET DELETE ALLOW;
      };
  };
  CREATE ABSTRACT TYPE default::Project EXTENDING default::Resource, default::Pinnable, default::Taggable {
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
          CREATE ANNOTATION std::description := 'The sensitivity of the project.\n        This is user settable for internships and calculated for translation projects';
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
  CREATE TYPE default::TranslationProject EXTENDING default::Project;
  CREATE FUNCTION default::str_trim_or_none(string: std::str) -> OPTIONAL std::str USING (WITH
      t := 
          std::str_trim(string, ' \t\r\n')
  SELECT
      (t IF (std::len(t) > 0) ELSE <std::str>{})
  );
  CREATE ABSTRACT TYPE Engagement::Ceremony EXTENDING default::Resource {
      CREATE PROPERTY actualDate: cal::local_date;
      CREATE PROPERTY estimatedDate: cal::local_date;
      CREATE REQUIRED PROPERTY planned: std::bool {
          SET default := false;
      };
  };
  CREATE TYPE Engagement::CertificationCeremony EXTENDING Engagement::Ceremony;
  CREATE TYPE Engagement::DedicationCeremony EXTENDING Engagement::Ceremony;
  CREATE SCALAR TYPE Engagement::Status EXTENDING enum<InDevelopment, DidNotDevelop, Rejected, Active, DiscussingTermination, DiscussingReactivation, DiscussingChangeToPlan, DiscussingSuspension, FinalizingCompletion, ActiveChangedPlan, Suspended, Terminated, Completed, Converted, Unapproved, Transferred, NotRenewed>;
  CREATE ABSTRACT TYPE default::Engagement EXTENDING default::Resource {
      CREATE REQUIRED LINK ceremony: Engagement::Ceremony {
          ON SOURCE DELETE DELETE TARGET;
          SET readonly := true;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED LINK project: default::Project {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE PROPERTY sensitivity := (.project.sensitivity);
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
  ALTER TYPE Engagement::Ceremony {
      CREATE SINGLE PROPERTY sensitivity := (.<ceremony[IS default::Engagement].sensitivity);
  };
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
  CREATE TYPE default::LanguageEngagement EXTENDING default::Engagement {
      ALTER LINK ceremony {
          SET default := (INSERT
              Engagement::DedicationCeremony
              {
                  createdAt := std::datetime_of_statement()
              });
          SET OWNED;
          SET REQUIRED;
          SET TYPE Engagement::DedicationCeremony USING (<Engagement::DedicationCeremony>{});
      };
      ALTER LINK project {
          SET OWNED;
          SET REQUIRED;
          SET TYPE default::TranslationProject USING (<default::TranslationProject>{});
      };
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
  CREATE TYPE default::InternshipEngagement EXTENDING default::Engagement {
      ALTER LINK ceremony {
          SET default := (INSERT
              Engagement::CertificationCeremony
              {
                  createdAt := std::datetime_of_statement()
              });
          SET OWNED;
          SET REQUIRED;
          SET TYPE Engagement::CertificationCeremony USING (<Engagement::CertificationCeremony>{});
      };
      ALTER LINK project {
          SET OWNED;
          SET REQUIRED;
          SET TYPE default::InternshipProject USING (<default::InternshipProject>{});
      };
  };
  CREATE TYPE default::Language EXTENDING default::Resource, default::Pinnable, default::Taggable {
      CREATE REQUIRED LINK ethnologue: Ethnologue::Language {
          SET default := (INSERT
              Ethnologue::Language
          );
          ON SOURCE DELETE DELETE TARGET;
      };
      CREATE PROPERTY populationOverride: default::population;
      CREATE PROPERTY population := ((.populationOverride ?? .ethnologue.population));
      CREATE OPTIONAL LINK firstScriptureEngagement: default::LanguageEngagement;
      CREATE REQUIRED PROPERTY hasExternalFirstScripture: std::bool {
          SET default := false;
      };
      CREATE CONSTRAINT std::expression ON (((EXISTS (.firstScriptureEngagement) AND NOT (.hasExternalFirstScripture)) OR NOT (EXISTS (.firstScriptureEngagement))));
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
      CREATE REQUIRED PROPERTY sensitivity: default::Sensitivity {
          SET default := (default::Sensitivity.High);
          CREATE ANNOTATION std::description := 'The sensitivity of the language. This is a source / user settable.';
      };
      CREATE PROPERTY signLanguageCode: std::str {
          CREATE CONSTRAINT std::regexp(r'^[A-Z]{2}\d{2}$');
      };
      CREATE PROPERTY sponsorEstimatedEndDate: cal::local_date;
  };
  ALTER TYPE default::Project {
      CREATE PROPERTY engagementTotal := (std::count(.<project[IS default::Engagement]));
  };
  ALTER TYPE default::InternshipProject {
      CREATE MULTI LINK engagements := (.<project[IS default::InternshipEngagement]);
  };
  ALTER TYPE default::TranslationProject {
      CREATE MULTI LINK engagements := (.<project[IS default::LanguageEngagement]);
  };
  ALTER TYPE default::InternshipEngagement {
      CREATE REQUIRED LINK intern: default::User {
          SET readonly := true;
      };
      CREATE CONSTRAINT std::exclusive ON ((.project, .intern));
      CREATE LINK mentor: default::User;
  };
  ALTER TYPE default::Pinnable {
      CREATE PROPERTY pinned := ((.id IN (<default::User>GLOBAL default::currentUserId).pins.id));
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE REQUIRED LINK language: default::Language {
          SET readonly := true;
      };
      CREATE PROPERTY firstScripture := (EXISTS (.language.firstScriptureEngagement));
      CREATE CONSTRAINT std::exclusive ON ((.project, .language));
  };
};
