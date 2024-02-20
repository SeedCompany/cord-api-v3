module ProgressReport {
  type VarianceExplanation {
    required report: default::ProgressReport {
      readonly := true;
    };
    
    reasons: array<str> {
      readonly := true;
    };

    comments: default::RichText {
      readonly := true;
    }; 
  }
}
  