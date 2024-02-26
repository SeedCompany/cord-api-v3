module default {
  type ProductProgress extending Mixin::Timestamped {
    product: Product;
    report: Report; # TODO - figure out the type of report
    variant: str; # TODO - merge with my prompt variant work
    multi steps: StepProgress;
  }
  type StepProgress extending Mixin::Timestamped {
    step: Product::Step;
    completed: float32;
  }
}
