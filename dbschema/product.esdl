module default {
  abstract type Product extending Engagement::Child {
    # https://github.com/edgedb/edgedb/issues/6766
    # overloaded engagement: LanguageEngagement;
    
    scripture: Scripture::Collection {
      on source delete delete target;
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

    access policy CanReadGeneratedFromAppPoliciesForOtherProduct
    allow select using (
      not exists default::currentUser
    );
    access policy CanCreateGeneratedFromAppPoliciesForOtherProduct
    allow insert using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForOtherProduct
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }
  
  type DirectScriptureProduct extending Product {
    unspecifiedScripture: Scripture::UnspecifiedPortion {
      on source delete delete target;
    };
    trigger deleteOldUnspecifiedScripture after update for each
      when (__old__.unspecifiedScripture ?!= __new__.unspecifiedScripture)
      do (delete __old__.unspecifiedScripture);
    trigger deleteOldScripture after update for each
      when (__old__.scripture ?!= __new__.scripture)
      do (delete __old__.scripture);
    
    totalVerses: int16;
    totalVerseEquivalents: float32;

    access policy CanReadGeneratedFromAppPoliciesForDirectScriptureProduct
    allow select using (
      not exists default::currentUser
    );
    access policy CanCreateGeneratedFromAppPoliciesForDirectScriptureProduct
    allow insert using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForDirectScriptureProduct
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }
  
  type DerivativeScriptureProduct extending Product {
    required produces: default::Producible;
    
    overloaded scripture {
      rewrite insert, update using (
        # coalescing `??` bugged with links
        # https://github.com/edgedb/edgedb/issues/6767
        if exists .scriptureOverride then
          if exists .scriptureOverride.verses then
          .scriptureOverride else {}
        else .produces.scripture
      );
      # This is not the source of truth, just a stored computed.
      on source delete allow;
    };
    
    scriptureOverride: Scripture::Collection {
      on source delete delete target;
    };
    trigger deleteOldScriptureOverride after update for each
      when (__old__.scriptureOverride ?!= __new__.scriptureOverride)
      do (delete __old__.scriptureOverride);
    
    required composite: bool { default := false };
    
    totalVerses: int16;
    totalVerseEquivalents: float32;

    access policy CanReadGeneratedFromAppPoliciesForDerivativeScriptureProduct
    allow select using (
      not exists default::currentUser
    );
    access policy CanCreateGeneratedFromAppPoliciesForDerivativeScriptureProduct
    allow insert using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForDerivativeScriptureProduct
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
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
