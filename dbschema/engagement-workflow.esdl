module Engagement {
  type WorkflowEvent extending Project::ContextAware {
    required engagement: default::Engagement {
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
    required to: Status {
      readonly := true;
    };
    notes: default::RichText {
      readonly := true;
    };

    trigger setEngagementStatus after insert for all do (
      update default::Engagement
      filter default::Engagement in __new__.engagement
      set {
        status := default::Engagement.latestWorkflowEvent.to ?? Engagement::Status.InDevelopment
      }
    );
    trigger refreshEngagementStatus after delete for all do (
      update default::Engagement
      filter default::Engagement in __old__.engagement
      set {
        status := default::Engagement.latestWorkflowEvent.to ?? Engagement::Status.InDevelopment
      }
    );
  }

  scalar type Status extending enum<
    InDevelopment,
    DidNotDevelop,
    Rejected,
    
    Active,
    ActiveChangedPlan,
    
    DiscussingTermination,
    DiscussingReactivation,
    DiscussingChangeToPlan,
    DiscussingSuspension,
    Suspended,
    
    FinalizingCompletion,
    Terminated,
    Completed,
    
    # deprecated / legacy
    Converted,
    Unapproved,
    Transferred,
    NotRenewed,
  >;
}