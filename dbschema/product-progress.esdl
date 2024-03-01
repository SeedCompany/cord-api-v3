module default {
  type ProductProgress extending Mixin::Timestamped {
    product: Product;
    report: PeriodicReport;
    variant: VariantProgress::Variant;
    multi steps: StepProgress;
  }
  type StepProgress extending Mixin::Timestamped {
    step: Product::Step;
    completed: float32;
  }
}

module VariantProgress {
  scalar type Variant extending enum<
    official,
    partner
  >
}
