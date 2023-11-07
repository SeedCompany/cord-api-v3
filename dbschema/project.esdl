module default {
  abstract type Project extending Resource, Mixin::Pinnable, Mixin::Taggable {
    required name: str {
      constraint exclusive;
    };
    
    required sensitivity: Sensitivity {
      annotation description := "The sensitivity of the project. \
        This is user settable for internships and calculated for translation projects";
      default := Sensitivity.High;
    };
    
    departmentId: str;
    
    required step: Project::Step {
      default := Project::Step.EarlyConversations;
    };
    required stepChangedAt: datetime {
      default := .createdAt;
      rewrite update using (datetime_of_statement() if .step != __old__.step else .stepChangedAt);
    }
    property status := Project::statusFromStep(.step);
    
    mouStart: cal::local_date;
    mouEnd: cal::local_date;
    constraint expression on (.mouEnd >= .mouStart);
    initialMouEnd: cal::local_date {
      default := .mouEnd;
      rewrite update using (.mouEnd if .status = Project::Status.InDevelopment else .initialMouEnd);
    }
    
    estimatedSubmission: cal::local_date;
    
    financialReportReceivedAt: datetime;
    financialReportPeriod: ReportPeriod;
    
    required presetInventory: bool {
      default := false;
    };
    
    multi link members := .<project[is Project::Member];
    single link membership := (select .members filter .user.id = global currentUserId limit 1);
    property isMember := exists .membership;
    
#     multi link engagements := .<project[is Engagement];
    property engagementTotal := count(.<project[is Engagement]);
    
#       link primaryLocation: Location;
#       link marketingLocation: Location;
#       link fieldRegion: FieldRegion;
#       link rootDirectory: Directory;
  }
  
  type TranslationProject extending Project {
    multi link engagements := .<project[is LanguageEngagement];
    multi link languages := .engagements.language;
    
    trigger confirmProjectSens after update for each do (
      assert(
        __new__.sensitivity = max(__new__.languages.ownSensitivity) ?? Sensitivity.High,
        message := "TranslationProject sensitivity is automatically set to \
          (and required to be) the highest sensitivity Language engaged"
      )
    );
  }
  
  type InternshipProject extending Project {
    multi link engagements := .<project[is InternshipEngagement];
  }
}
 
module Project {
  abstract type Resource extending default::Resource {
    required project: default::Project {
      readonly := true;
      on target delete delete source;
    };
    
#     property sensitivity := .project.sensitivity;
    property isMember := .project.isMember;
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
