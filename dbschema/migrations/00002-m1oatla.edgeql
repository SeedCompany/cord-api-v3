CREATE MIGRATION m1oatla3xkxgpqdkclpj7rxmrcimqfnp5ikwfrdco4muttq5jrfy2a
    ONTO m1zafsshfknkck6a7esom7ck425amgmeqx2pds6zimbvsajhz2ekfq
{
  CREATE MODULE Budget IF NOT EXISTS;
  CREATE MODULE Media IF NOT EXISTS;
  CREATE MODULE Organization IF NOT EXISTS;
  CREATE MODULE Partner IF NOT EXISTS;
  CREATE MODULE Partnership IF NOT EXISTS;
  CREATE MODULE ProgressReport IF NOT EXISTS;
  CREATE MODULE ProgressReport::Media IF NOT EXISTS;
  CREATE MODULE ProgressReport::ProductProgress IF NOT EXISTS;
  CREATE MODULE Prompt IF NOT EXISTS;
  CREATE MODULE Scripture IF NOT EXISTS;
  CREATE TYPE Budget::Record EXTENDING Project::Child {
      CREATE REQUIRED PROPERTY fiscalYear: std::int16 {
          SET readonly := true;
      };
      CREATE PROPERTY amount: std::float32;
  };
  CREATE SCALAR TYPE Budget::Status EXTENDING enum<Pending, Current, Superceded, Rejected>;
  CREATE TYPE default::Budget EXTENDING Project::Child {
      CREATE REQUIRED PROPERTY status: Budget::Status {
          SET default := (Budget::Status.Pending);
      };
      CREATE LINK universalTemplate: default::File;
  };
  ALTER TYPE Budget::Record {
      CREATE REQUIRED LINK budget: default::Budget {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
  };
  CREATE SCALAR TYPE Organization::Reach EXTENDING enum<Local, Regional, National, `Global`>;
  CREATE SCALAR TYPE Organization::Type EXTENDING enum<Church, Parachurch, Mission, TranslationOrganization, Alliance>;
  CREATE TYPE default::Organization EXTENDING default::Resource, Project::ContextAware, Mixin::Named {
      ALTER LINK projectContext {
          SET default := (INSERT
              Project::Context
          );
          ON SOURCE DELETE DELETE TARGET;
          SET OWNED;
          SET TYPE Project::Context;
      };
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE MULTI LINK locations: default::Location;
      CREATE PROPERTY acronym: std::str;
      CREATE PROPERTY address: std::str;
      CREATE MULTI PROPERTY reach: Organization::Reach;
      CREATE MULTI PROPERTY types: Organization::Type;
  };
  ALTER TYPE Budget::Record {
      CREATE REQUIRED LINK organization: default::Organization {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE CONSTRAINT std::exclusive ON ((.budget, .fiscalYear, .organization));
  };
  ALTER TYPE default::Budget {
      CREATE LINK records := (.<budget[IS Budget::Record]);
  };
  CREATE ABSTRACT TYPE default::Media {
      CREATE REQUIRED LINK file: File::Version {
          SET readonly := true;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY altText: std::str;
      CREATE PROPERTY caption: std::str;
      CREATE REQUIRED PROPERTY mimeType: std::str;
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
  CREATE SCALAR TYPE Product::Medium EXTENDING enum<Print, Web, EBook, App, TrainedStoryTellers, Audio, Video, Other>;
  CREATE TYPE Product::PartnershipProducingMedium EXTENDING Engagement::Child {
      CREATE REQUIRED PROPERTY medium: Product::Medium;
  };
  CREATE SCALAR TYPE Partner::Type EXTENDING enum<Managing, Funding, Impact, Technical, Resource>;
  CREATE SCALAR TYPE Partnership::AgreementStatus EXTENDING enum<NotAttached, AwaitingSignature, Signed>;
  CREATE SCALAR TYPE Partnership::FinancialReportingType EXTENDING enum<Funded, FieldEngaged, Hybrid>;
  CREATE TYPE default::Partnership EXTENDING Project::Child {
      CREATE LINK agreement: default::File;
      CREATE LINK mou: default::File;
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
  ALTER TYPE Product::PartnershipProducingMedium {
      CREATE REQUIRED LINK partnership: default::Partnership {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE CONSTRAINT std::exclusive ON ((.engagement, .partnership, .medium));
  };
  CREATE ABSTRACT TYPE ProgressReport::Child EXTENDING Engagement::Child {
      CREATE ANNOTATION std::description := 'A type that is a child of a progress report. It will always have a reference to a single progress report and engagement that it is under.';
  };
  CREATE ABSTRACT TYPE Prompt::PromptVariantResponse EXTENDING default::Resource, Mixin::Embedded {
      CREATE PROPERTY promptId: default::nanoid;
      CREATE ANNOTATION std::description := 'An instance of a prompt and the responses per variant.';
  };
  CREATE TYPE ProgressReport::CommunityStory EXTENDING ProgressReport::Child, Prompt::PromptVariantResponse;
  CREATE TYPE ProgressReport::Highlight EXTENDING ProgressReport::Child, Prompt::PromptVariantResponse;
  CREATE TYPE ProgressReport::Media::VariantGroup;
  ALTER TYPE default::File {
      CREATE SINGLE LINK media := (.latestVersion.<file[IS default::Media]);
  };
  CREATE TYPE ProgressReport::Media EXTENDING ProgressReport::Child {
      CREATE REQUIRED LINK variantGroup: ProgressReport::Media::VariantGroup;
      CREATE REQUIRED PROPERTY variant: std::str;
      CREATE CONSTRAINT std::exclusive ON ((.variantGroup, .variant));
      CREATE REQUIRED LINK file: default::File;
      CREATE REQUIRED SINGLE LINK media := (std::assert_exists(.file.media));
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
  CREATE TYPE ProgressReport::TeamNews EXTENDING ProgressReport::Child, Prompt::PromptVariantResponse;
  CREATE TYPE ProgressReport::VarianceExplanation EXTENDING ProgressReport::Child {
      CREATE PROPERTY comments: default::RichText;
      CREATE MULTI PROPERTY reasons: std::str;
  };
  CREATE SCALAR TYPE ProgressReport::Status EXTENDING enum<NotStarted, InProgress, PendingTranslation, InReview, Approved, Published>;
  CREATE ABSTRACT TYPE default::PeriodicReport EXTENDING default::Resource, Mixin::Embedded {
      CREATE LINK reportFile: default::File;
      CREATE REQUIRED PROPERTY period: range<cal::local_date>;
      CREATE PROPERTY `end` := (default::date_range_get_upper(.period));
      CREATE PROPERTY receivedDate: cal::local_date;
      CREATE PROPERTY skippedReason: std::str;
      CREATE PROPERTY `start` := (std::range_get_lower(.period));
  };
  CREATE TYPE default::ProgressReport EXTENDING default::PeriodicReport, Engagement::Child {
      ALTER LINK engagement {
          SET OWNED;
          SET TYPE default::LanguageEngagement USING (<default::LanguageEngagement>{});
      };
      ALTER LINK container {
          SET OWNED;
          SET TYPE default::LanguageEngagement USING (<default::LanguageEngagement>{});
      };
  };
  ALTER TYPE ProgressReport::Child {
      CREATE REQUIRED LINK report: default::ProgressReport {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
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
  ALTER TYPE ProgressReport::VarianceExplanation {
      ALTER LINK report {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
  };
  CREATE TYPE Prompt::VariantResponse EXTENDING Mixin::Audited {
      CREATE REQUIRED LINK pvr: Prompt::PromptVariantResponse;
      CREATE REQUIRED PROPERTY variant: std::str;
      CREATE CONSTRAINT std::exclusive ON ((.pvr, .variant));
      CREATE ANNOTATION std::description := 'A response (for a variant) to an instance of a prompt.';
      CREATE PROPERTY response: default::RichText;
  };
  ALTER TYPE Prompt::PromptVariantResponse {
      CREATE LINK responses := (.<pvr[IS Prompt::VariantResponse]);
  };
  ALTER TYPE default::ProgressReport {
      CREATE SINGLE LINK varianceExplanation := (.<report[IS ProgressReport::VarianceExplanation]);
  };
  CREATE TYPE ProgressReport::WorkflowEvent {
      CREATE REQUIRED LINK report: default::ProgressReport {
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY at: std::datetime {
          SET default := (std::datetime_of_statement());
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY status: ProgressReport::Status {
          SET readonly := true;
      };
      CREATE REQUIRED LINK who: default::User {
          SET default := (GLOBAL default::currentUser);
          SET readonly := true;
      };
      CREATE PROPERTY notes: default::RichText {
          SET readonly := true;
      };
      CREATE PROPERTY transitionId: default::nanoid {
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
  CREATE SCALAR TYPE Product::Step EXTENDING enum<ExegesisAndFirstDraft, TeamCheck, CommunityTesting, BackTranslation, ConsultantCheck, InternalizationAndDrafting, PeerRevision, ConsistencyCheckAndFinalEdits, Craft, Test, `Check`, Record, Develop, Translate, Completed>;
  CREATE SCALAR TYPE ProgressReport::ProductProgress::Variant EXTENDING enum<Official, Partner>;
  CREATE TYPE ProgressReport::ProductProgress::Step EXTENDING Mixin::Timestamped, Project::ContextAware {
      CREATE REQUIRED LINK report: default::ProgressReport;
      CREATE REQUIRED PROPERTY step: Product::Step;
      CREATE REQUIRED PROPERTY variant: ProgressReport::ProductProgress::Variant;
      CREATE PROPERTY completed: std::float32;
  };
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
  CREATE TYPE Project::WorkflowEvent EXTENDING Project::ContextAware {
      CREATE REQUIRED LINK project: default::Project {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY at: std::datetime {
          SET default := (std::datetime_of_statement());
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY to: Project::Step {
          SET readonly := true;
      };
      CREATE REQUIRED LINK who: default::Actor {
          SET default := (GLOBAL default::currentActor);
          SET readonly := true;
      };
      CREATE PROPERTY notes: default::RichText {
          SET readonly := true;
      };
      CREATE PROPERTY transitionKey: std::uuid {
          SET readonly := true;
      };
  };
  ALTER TYPE default::Project {
      CREATE LINK workflowEvents := (.<project[IS Project::WorkflowEvent]);
      CREATE LINK latestWorkflowEvent := (SELECT
          .workflowEvents ORDER BY
              .at DESC
      LIMIT
          1
      );
      CREATE TRIGGER assertMatchingLatestWorkflowEvent
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert(((__new__.latestWorkflowEvent.to ?= __new__.step) OR (NOT (EXISTS (__new__.latestWorkflowEvent)) AND (__new__.step = Project::Step.EarlyConversations))), message := 'Project step must match the latest workflow event'));
      CREATE TRIGGER createBudgetOnInsert
          AFTER INSERT 
          FOR EACH DO (INSERT
              default::Budget
              {
                  createdAt := std::datetime_of_statement(),
                  modifiedAt := std::datetime_of_statement(),
                  createdBy := std::assert_exists(GLOBAL default::currentActor),
                  modifiedBy := std::assert_exists(GLOBAL default::currentActor),
                  project := __new__,
                  projectContext := __new__.projectContext
              });
  };
  ALTER TYPE Project::WorkflowEvent {
      CREATE TRIGGER refreshProjectStep
          AFTER DELETE 
          FOR ALL DO (UPDATE
              default::Project
          FILTER
              (default::Project IN __old__.project)
          SET {
              step := (default::Project.latestWorkflowEvent.to ?? Project::Step.EarlyConversations)
          });
      CREATE TRIGGER setProjectStep
          AFTER INSERT 
          FOR ALL DO (UPDATE
              default::Project
          FILTER
              (default::Project IN __new__.project)
          SET {
              step := (default::Project.latestWorkflowEvent.to ?? Project::Step.EarlyConversations)
          });
  };
  CREATE TYPE Scripture::Collection {
      CREATE REQUIRED PROPERTY label: std::str {
          SET readonly := true;
      };
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
  ALTER TYPE default::Product {
      CREATE LINK scripture: Scripture::Collection {
          ON SOURCE DELETE DELETE TARGET;
      };
  };
  CREATE TYPE default::DirectScriptureProduct EXTENDING default::Product {
      CREATE TRIGGER deleteOldScripture
          AFTER UPDATE 
          FOR EACH 
              WHEN ((__old__.scripture ?!= __new__.scripture))
          DO (DELETE
              __old__.scripture
          );
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
  CREATE TYPE default::DerivativeScriptureProduct EXTENDING default::Product {
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
      CREATE REQUIRED PROPERTY composite: std::bool {
          SET default := false;
      };
      CREATE PROPERTY totalVerseEquivalents: std::float32;
      CREATE PROPERTY totalVerses: std::int16;
  };
  CREATE ABSTRACT TYPE default::Producible EXTENDING default::Resource, Mixin::Named {
      CREATE LINK scripture: Scripture::Collection {
          ON SOURCE DELETE DELETE TARGET;
      };
      ALTER PROPERTY name {
          SET OWNED;
          CREATE DELEGATED CONSTRAINT std::exclusive;
      };
  };
  ALTER TYPE default::DerivativeScriptureProduct {
      CREATE REQUIRED LINK produces: default::Producible;
  };
  CREATE TYPE default::EthnoArt EXTENDING default::Producible;
  ALTER TYPE default::Producible {
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
  CREATE TYPE default::Film EXTENDING default::Producible;
  CREATE TYPE default::Story EXTENDING default::Producible;
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
  CREATE TYPE default::OtherProduct EXTENDING default::Product {
      CREATE PROPERTY description: std::str;
      CREATE REQUIRED PROPERTY title: std::str;
  };
  CREATE TYPE default::FieldRegion EXTENDING default::Resource, Mixin::Named {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED LINK director: default::User;
  };
  CREATE TYPE default::FieldZone EXTENDING default::Resource, Mixin::Named {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED LINK director: default::User;
  };
  ALTER TYPE default::FieldRegion {
      CREATE REQUIRED LINK fieldZone: default::FieldZone;
  };
  ALTER TYPE default::FieldZone {
      CREATE LINK fieldRegions := (.<fieldZone[IS default::FieldRegion]);
  };
  ALTER TYPE default::Location {
      CREATE LINK defaultFieldRegion: default::FieldRegion;
  };
  ALTER TYPE default::Project {
      CREATE LINK fieldRegion: default::FieldRegion;
      CREATE LINK marketingRegionOverride: default::FieldRegion;
      CREATE LINK partnerships := (.<project[IS default::Partnership]);
  };
  CREATE TYPE default::Partner EXTENDING default::Resource, Project::ContextAware, Mixin::Named, Mixin::Pinnable, Mixin::Taggable {
      CREATE MULTI LINK fieldRegions: default::FieldRegion;
      CREATE REQUIRED LINK organization: default::Organization {
          ON SOURCE DELETE DELETE TARGET;
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
          CREATE CONSTRAINT std::exclusive;
      };
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE MULTI LINK countries: default::Location;
      CREATE LINK languageOfWiderCommunication: default::Language;
      CREATE MULTI LINK languagesOfConsulting: default::Language;
      CREATE LINK pointOfContact: default::User;
      CREATE REQUIRED PROPERTY active: std::bool {
          SET default := true;
      };
      CREATE PROPERTY address: std::str;
      CREATE MULTI PROPERTY financialReportingTypes: Partnership::FinancialReportingType;
      CREATE REQUIRED PROPERTY globalInnovationsClient: std::bool {
          SET default := false;
      };
      CREATE PROPERTY pmcEntityCode: std::str {
          CREATE CONSTRAINT std::regexp('^[A-Z]{3}$');
      };
      CREATE PROPERTY startDate: cal::local_date;
      CREATE MULTI PROPERTY types: Partner::Type;
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
  };
  ALTER TYPE default::Partnership {
      CREATE REQUIRED LINK partner: default::Partner;
      CREATE LINK organization := (.partner.organization);
      CREATE CONSTRAINT std::exclusive ON ((.project, .partner));
  };
};
