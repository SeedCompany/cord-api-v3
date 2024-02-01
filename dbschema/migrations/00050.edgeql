CREATE MIGRATION m1vlgekf4eyzweb6xmldmxwzohoh7xbrre6fbc7e2d3t7q7ry3qobq
    ONTO m1kzwpoy3r3awvbzqxxzz3upkkemxjtf33ra53zkuxzexsc7r5x4zq
{
  CREATE MODULE Product IF NOT EXISTS;
  CREATE TYPE Scripture::UnspecifiedPortion {
      CREATE REQUIRED PROPERTY book: std::str {
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY totalVerses: std::int16 {
          SET readonly := true;
          CREATE CONSTRAINT std::min_value(1);
      };
  };
  CREATE SCALAR TYPE Product::Medium EXTENDING enum<Print, Web, EBook, App, TrainedStoryTellers, Audio, Video, Other>;
  CREATE SCALAR TYPE Product::Methodology EXTENDING enum<Paratext, OtherWritten, Render, Audacity, AdobeAudition, OtherOralTranslation, StoryTogether, SeedCompanyMethod, OneStory, Craft2Tell, OtherOralStories, Film, SignLanguage, OtherVisual>;
  CREATE SCALAR TYPE Product::ProgressMeasurement EXTENDING enum<Number, Percent, Boolean>;
  CREATE SCALAR TYPE Product::Purpose EXTENDING enum<EvangelismChurchPlanting, ChurchLife, ChurchMaturity, SocialIssues, Discipleship>;
  CREATE SCALAR TYPE Product::Step EXTENDING enum<ExegesisAndFirstDraft, TeamCheck, CommunityTesting, BackTranslation, ConsultantCheck, InternalizationAndDrafting, PeerRevision, ConsistencyCheckAndFinalEdits, Craft, Test, `Check`, Record, Develop, Translate, Completed>;
  CREATE ABSTRACT TYPE default::Product EXTENDING Engagement::Child {
      CREATE LINK scripture: Scripture::Collection {
          ON SOURCE DELETE DELETE TARGET IF ORPHAN;
      };
      CREATE PROPERTY describeCompletion: std::str;
      CREATE MULTI PROPERTY mediums: Product::Medium;
      CREATE PROPERTY methodology: Product::Methodology;
      CREATE PROPERTY placeholderDescription: std::str;
      CREATE PROPERTY pnpIndex: std::int16;
      CREATE PROPERTY progressStepMeasurement: Product::ProgressMeasurement;
      CREATE PROPERTY progressTarget: std::int16;
      CREATE MULTI PROPERTY purposes: Product::Purpose;
      CREATE MULTI PROPERTY steps: Product::Step;
      CREATE TRIGGER denyEmptyScriptureCollection
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((NOT (EXISTS (__new__.scripture)) OR EXISTS (__new__.scripture.verses)), message := '`Product.scripture` should have a `Scripture::Collection` with verses or be null/empty-set'));
  };
  CREATE TYPE default::DirectScriptureProduct EXTENDING default::Product {
      CREATE LINK unspecifiedScripture: Scripture::UnspecifiedPortion {
          ON SOURCE DELETE DELETE TARGET IF ORPHAN;
      };
      CREATE PROPERTY totalVerseEquivalents: std::int32;
      CREATE PROPERTY totalVerses: std::int16;
  };
  CREATE TYPE default::DerivativeScriptureProduct EXTENDING default::Product {
      CREATE REQUIRED LINK produces: default::Producible;
      ALTER LINK scripture {
          SET OWNED;
      };
      CREATE LINK scriptureOverride: Scripture::Collection {
          ON SOURCE DELETE DELETE TARGET IF ORPHAN;
      };
      ALTER LINK scripture {
          CREATE REWRITE
              INSERT 
              USING ((IF EXISTS (.scriptureOverride) THEN .scriptureOverride ELSE .produces.scripture));
          CREATE REWRITE
              UPDATE 
              USING ((IF EXISTS (.scriptureOverride) THEN .scriptureOverride ELSE .produces.scripture));
      };
      CREATE REQUIRED PROPERTY composite: std::bool {
          SET default := false;
      };
      CREATE PROPERTY totalVerseEquivalents: std::int32;
      CREATE PROPERTY totalVerses: std::int16;
  };
  ALTER TYPE default::Producible {
      CREATE TRIGGER updateDerivativeProducts
          AFTER UPDATE 
          FOR EACH DO (UPDATE
              __new__.<produces[IS default::DerivativeScriptureProduct]
          FILTER
              ((__new__.scripture != __old__.scripture) AND NOT (EXISTS (.scriptureOverride)))
          SET {
              scripture := __new__.scripture
          });
      ALTER TRIGGER denyEmptyScriptureCollection USING (std::assert((NOT (EXISTS (__new__.scripture)) OR EXISTS (__new__.scripture.verses)), message := '`Producible.scripture` should have a `Scripture::Collection` with verses or be null/empty-set'));
  };
  CREATE TYPE default::OtherProduct EXTENDING default::Product {
      CREATE PROPERTY description: std::str;
      CREATE REQUIRED PROPERTY title: std::str;
  };
};
