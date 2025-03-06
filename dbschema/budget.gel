module default {
  type Budget extending Project::Child {
    required status: Budget::Status {
      default := Budget::Status.Pending;
    };
    
    universalTemplate: File;
    
    records := .<budget[is Budget::Record];
  }
}
  
module Budget {
  type Record extending Project::Child {
    constraint exclusive on ((.budget, .fiscalYear, .organization));
    
    required fiscalYear: int16 {
      readonly := true;
    };
    
    amount: float32;
    
    required budget: default::Budget {
      readonly := true;
      on target delete delete source;
    };
    
    required organization: default::Organization {
      readonly := true;
      on target delete delete source;
    };
  }
  
  scalar type Status extending enum<
    Pending,
    Current,
    Superceded,
    Rejected
  >;
}
