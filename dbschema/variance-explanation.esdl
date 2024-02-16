module ProgressReport {
  type VarianceExplanation {
    required report: default::ProgressReport {
      readonly := true;
    };
    
    reasons: array<str> {  #TODO: figure out how to constrain to IsIn([...ReasonOptions])
      readonly := true;
    };

    comments: default::RichText {
      readonly := true;
    }; 
  }
}
  
module VarianceExplanation {
  type ReasonOptions { 
    required deprecated: str {  #TODO: figure out how to make this a ReadonlySet and default to new JsonSet
      readonly := true;
    };

    required behind: str { #TODO: figure out how to make this a ReadonlySet and default to a new JsonSet
      readonly := true;
    };
     
    required onTime: str { #TODO: figure out how to make this a ReadonlySet and default to a new JsonSet
      readonly := true;
    };

    required ahead: str { #TODO: figure out how to make this a ReadonlySet and default to a new JsonSet
      readonly := true;
    };
  }
}