module default {
  type ProductProgress extending Mixin::Timestamped {
    id: str;
    productId: str;
    reportId: str;
    variant: str; # ID of Variant??
    multi steps: StepProgress;
  }
  type StepProgress extending Mixin::Timestamped {
    id: str;
    step: ProductStep::Type;
    completed: float32;
  }
}

module ProductStep {
  scalar type Type extending enum<
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
