module default {
  abstract type Product extending Engagement::Child {
    # https://github.com/edgedb/edgedb/issues/6766
    # overloaded engagement: LanguageEngagement;
    
    scripture: Scripture::Collection {
      on source delete delete target if orphan;
    };
    
    multi mediums: Product::Medium;
    multi purposes: Product::Purpose;
    multi steps: Product::Step;
    methodology: Product::Methodology;
    
    describeCompletion: str;
    placeholderDescription: str;
    pnpIndex: int16;
    progressTarget: int16;
    progressStepMeasurement: Product::ProgressMeasurement;
    
    #TODO - category := ??? - add this computed field here after migration
    
    # Enforce no empty collections for this type's use-case. Use null/empty-set instead.
    trigger denyEmptyScriptureCollection after insert, update for each do (
      assert(
        not exists __new__.scripture or exists __new__.scripture.verses,
        message := "`Product.scripture` should have a `Scripture::Collection` with verses or be null/empty-set"
      )
    );
  }
  
  type DirectScriptureProduct extending Product {
    unspecifiedScripture: Scripture::UnspecifiedPortion {
      on source delete delete target if orphan;
    };
    
    totalVerses: int16;
    totalVerseEquivalents: float32;
  }
  
  type DerivativeScriptureProduct extending Product {
    required produces: default::Producible;
    
    overloaded scripture {
      rewrite insert, update using (
        # coalescing `??` bugged with links
        # https://github.com/edgedb/edgedb/issues/6767
        if exists .scriptureOverride then .scriptureOverride else .produces.scripture
      );
    };
    
    scriptureOverride: Scripture::Collection {
      on source delete delete target if orphan;
    };
    
    required composite: bool { default := false };
    
    totalVerses: int16;
    totalVerseEquivalents: float32;
  }
  
  type OtherProduct extending Product {
    required title: str;
    description: str;
  }
}
  
module Product {
  scalar type Medium extending enum<
    Print,
    Web,
    EBook,
    App,
    TrainedStoryTellers,
    Audio,
    Video,
    Other
  >;
  
  scalar type Methodology extending enum<
    Paratext,
    OtherWritten,
    Render,
    Audacity,
    AdobeAudition,
    OtherOralTranslation,
    StoryTogether,
    SeedCompanyMethod,
    OneStory,
    Craft2Tell,
    OtherOralStories,
    Film,
    SignLanguage,
    OtherVisual,
  >;
  
  scalar type ProgressMeasurement extending enum<
    Number,
    Percent,
    Boolean
  >;
  
  scalar type Purpose extending enum<
    EvangelismChurchPlanting,
    ChurchLife,
    ChurchMaturity,
    SocialIssues,
    Discipleship
  >;
  
  scalar type Step extending enum<
    ExegesisAndFirstDraft,
    TeamCheck,
    CommunityTesting,
    BackTranslation,
    ConsultantCheck,
    InternalizationAndDrafting,
    PeerRevision,
    ConsistencyCheckAndFinalEdits,
    Craft,
    Test,
    `Check`,
    Record,
    Develop,
    Translate,
    Completed,
  >;
}
