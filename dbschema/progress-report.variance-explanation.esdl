module ProgressReport {
  type VarianceExplanation extending ProgressReport::Child, Engagement::Child {
    required report: default::ProgressReport {
      readonly := true;
    };
    
    multi reasons: str; 

    comments: default::RichText;
  }
}
  