module ProgressReport::ProductProgress {
  type Step extending Mixin::Timestamped {
    required report: default::ProgressReport;
    required product: default::Product;
    required variant: Variant;
    required step: Product::Step;
    constraint exclusive on ((.report, .product, .variant, .step));

    completed: float32;
  }

  scalar type Variant extending enum<
    Official,
    Partner
  >
}
