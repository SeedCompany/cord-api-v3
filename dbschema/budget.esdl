module default {
  type Budget extending Project::Child {
    required status: Budget::Status {
      default := Budget::Status.Pending;
    };
    
    universalTemplate: File;
    
    records := .<budget[is Budget::Record];

    access policy CanSelectGeneratedFromAppPoliciesForBudget
    allow select using (
      (
        exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          default::Role.ConsultantManager in (<default::User>(global default::currentUserId)).roles
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForBudget
    allow insert;

    access policy CanDeleteGeneratedFromAppPoliciesForBudget
    allow delete;
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

    access policy CanSelectGeneratedFromAppPoliciesForBudgetRecord
    allow select using (
      (
        exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          default::Role.ConsultantManager in (<default::User>(global default::currentUserId)).roles
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForBudgetRecord
    allow insert;

    access policy CanDeleteGeneratedFromAppPoliciesForBudgetRecord
    allow delete;
  }
  
  scalar type Status extending enum<
    Pending,
    Current,
    Superceded,
    Rejected
  >;
}
