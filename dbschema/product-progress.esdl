module default {
  type StepProgress extending Mixin::Timestamped {
    required productProgress: ProductProgress;
    required step: Product::Step;
    completed: float32;
    
    constraint exclusive on ((.productProgress, .step));
  }
  type ProductProgress extending Mixin::Timestamped {
    required product: Product;
    required report: ProgressReport;
    required variant: ProductProgress::Variant;
    steps := .<productProgress[is StepProgress];
    
    constraint exclusive on ((.report, .product, .variant));
  }
}

module ProductProgress {
  scalar type Variant extending enum<
    official,
    partner
  >
}
