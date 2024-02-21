module ProgressReport {
  type VarianceExplanation extending ProgressReport::Child {
    required report: default::ProgressReport {
      readonly := true;
    };
    
    multi reasons: str; 

    comments: default::RichText;
  }
}
  