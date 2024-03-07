module ProgressReport::ProductProgress {
  type Step extending Mixin::Timestamped {
    required report: default::ProgressReport;
    required product: default::Product;
    required variant: Variant;
    required step: Product::Step;
    constraint exclusive on ((.report, .product, .variant, .step));

    completed: float32;
  }

  type Summary {
    required report: default::ProgressReport;
    required period: Period;
    constraint exclusive on ((.report, .period));

    required planned: float32;
    required actual: float32;

    totalVerses: int16;
    totalVerseEquivalents: float32;
  }

  scalar type Variant extending enum<
    Official,
    Partner
  >;
  scalar type Period extending enum<
    ReportPeriod,
    FiscalYearSoFar,
    Cumulative,
  >;
}
