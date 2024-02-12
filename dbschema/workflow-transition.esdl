module ProgressReport {
  type WorkflowTransition {
    required to: ProgressReport::Status{
      readonly := true;
    };
    required label: str {
      readonly := true;
    };
    required type: WorkflowTransition::Type {
      readonly := true;
    };
  }

  type InternalTransition extending WorkflowTransition {
    required name: WorkflowTransition::Name;
    from: array<ProgressReport::Status> {
      readonly := true;
    };
    `notify`: MembersWithRoles;
    
  }

  type MembersWithRoles {
    memberWithRoles: array<Role> {
      readonly := true;
    };;
  }
}

module WorkflowTransition {
  scalar type Type extending enum<
    Neutral,
    Approve,
    `Reject`,
  >;

  scalar type Name extending enum<
    `Start`,
    `In Progress -> Pending Translation`,
    `In Progress -> In Review`,
    `Translation Done`,
    `Translation Reject`,
    `Withdraw Review Request`,
    `In Review -> Needs Translation`,
    `Review Reject`,
    `Review Approve`,
    Publish,
  >;
}