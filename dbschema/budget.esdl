module default {
  type Budget extending Project::Child {
    required status: Budget::Status {
      default := Budget::Status.Pending;
    };
    
    universalTemplate: File;
    
    records := .<budget[is Budget::Record];

    access policy CanReadGeneratedFromAppPoliciesForBudget
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FinancialAnalyst', 'Fundraising', 'LeadFinancialAnalyst', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
        or (default::Role.ConsultantManager in default::currentUser.roles and (.isMember or .sensitivity <= default::Sensitivity.Medium))
    );
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

    access policy CanReadGeneratedFromAppPoliciesForBudgetRecord
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FinancialAnalyst', 'Fundraising', 'LeadFinancialAnalyst', 'Leadership', 'Marketing', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
        or (default::Role.ConsultantManager in default::currentUser.roles and (.isMember or .sensitivity <= default::Sensitivity.Medium))
    );
  }
  
  scalar type Status extending enum<
    Pending,
    Current,
    Superceded,
    Rejected
  >;
}
