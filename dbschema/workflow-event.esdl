module ProgressReport {
  type WorkflowEvent {
    required who: default::User {
      readonly := true;
      default := default::currentUser;
    };
    required at: datetime {
      readonly := true;
      default := datetime_of_statement();
    };
    transition: ProgressReport::InternalTransition {
      readonly := true;
    };
    required status: ProgressReport::Status {
      readonly := true;
    };
    notes: default::RichText {
      readonly := true;
    };
  }
}
  