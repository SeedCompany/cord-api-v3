module default {
  type Budget extending Project::Child {
    required status: Budget::Status {
      default := Budget::Status.Pending;
    };
    
    universalTemplate: File;
    
    records := .<budget[is Budget::Record];

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForBudget
    allow select, update read using (
      (
        exists (<Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector'} intersect global currentRoles)
        or (
          Role.ConsultantManager in global currentRoles
          and (
            .isMember
            or .sensitivity <= Sensitivity.Medium
          )
        )
      )
    );

    access policy CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForBudget
    allow update write, insert, delete;
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

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForBudgetRecord
    allow select, update read using (
      (
        exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector'} intersect global default::currentRoles)
        or (
          default::Role.ConsultantManager in global default::currentRoles
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
      )
    );

    access policy CanUpdateWriteInsertDeleteGeneratedFromAppPoliciesForBudgetRecord
    allow update write, insert, delete;
  }
  
  scalar type Status extending enum<
    Pending,
    Current,
    Superceded,
    Rejected
  >;
}
