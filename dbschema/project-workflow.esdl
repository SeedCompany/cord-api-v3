module Project {
  type WorkflowEvent {
    required project: default::Project {
      readonly := true;
      on target delete delete source;
    };
    required who: default::Actor {
      readonly := true;
      default := global default::currentActor;
    };
    required at: datetime {
      readonly := true;
      default := datetime_of_statement();
    };
    transitionKey: uuid {
      readonly := true;
    };
    required to: Step {
      readonly := true;
    };
    notes: default::RichText {
      readonly := true;
    };
  }

  scalar type Step extending enum<
    EarlyConversations,
    PendingConceptApproval,
    PrepForConsultantEndorsement,
    PendingConsultantEndorsement,
    PrepForFinancialEndorsement,
    PendingFinancialEndorsement,
    FinalizingProposal,
    PendingRegionalDirectorApproval,
    PendingZoneDirectorApproval,
    PendingFinanceConfirmation,
    OnHoldFinanceConfirmation,
    DidNotDevelop,
    Rejected,
    Active,
    ActiveChangedPlan,
    DiscussingChangeToPlan,
    PendingChangeToPlanApproval,
    PendingChangeToPlanConfirmation,
    DiscussingSuspension,
    PendingSuspensionApproval,
    Suspended,
    DiscussingReactivation,
    PendingReactivationApproval,
    DiscussingTermination,
    PendingTerminationApproval,
    FinalizingCompletion,
    Terminated,
    Completed,
  >;

  scalar type Status extending enum<
    InDevelopment,
    Active,
    Terminated,
    Completed,
    DidNotDevelop,
  >;

  function statusFromStep(step: Step) -> Status
    using (
      with dev := {
        Step.EarlyConversations,
        Step.PendingConceptApproval,
        Step.PrepForConsultantEndorsement,
        Step.PendingConsultantEndorsement,
        Step.PrepForFinancialEndorsement,
        Step.PendingFinancialEndorsement,
        Step.FinalizingProposal,
        Step.PendingRegionalDirectorApproval,
        Step.PendingZoneDirectorApproval,
        Step.PendingFinanceConfirmation,
        Step.OnHoldFinanceConfirmation,
      },
      active := {
        Step.Active,
        Step.ActiveChangedPlan,
        Step.DiscussingChangeToPlan,
        Step.PendingChangeToPlanApproval,
        Step.PendingChangeToPlanConfirmation,
        Step.DiscussingSuspension,
        Step.PendingSuspensionApproval,
        Step.Suspended,
        Step.DiscussingReactivation,
        Step.PendingReactivationApproval,
        Step.DiscussingTermination,
        Step.PendingTerminationApproval,
        Step.FinalizingCompletion,
      }
    select
      Status.InDevelopment if step in dev else
      Status.Active        if step in active else
      Status.DidNotDevelop if step = Step.DidNotDevelop else
      Status.DidNotDevelop if step = Step.Rejected else
      Status.Terminated    if step = Step.Terminated else
      Status.Completed     if step = Step.Completed else
      Status.InDevelopment
    )
}
