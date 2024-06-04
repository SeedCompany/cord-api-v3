module default {
  abstract type Project extending
    Mixin::Postable,
    Comments::Aware,
    Resource,
    Project::ContextAware,
    Mixin::Named,
    Mixin::Pinnable,
    Mixin::Taggable
  {
    overloaded name {
      constraint exclusive;
    };
    
    overloaded required ownSensitivity: Sensitivity {
      annotation description := "The sensitivity of the project. \
        This is user settable for internships and calculated for translation projects";
      default := Sensitivity.High;
    };
    
    departmentId: str {
      constraint exclusive;
      constraint expression on (<int32>__subject__ > 0 and len(__subject__) = 5);
      rewrite insert, update using (
        if (
          not exists .departmentId and
          .status <= Project::Status.Active and
          .step >= Project::Step.PendingFinanceConfirmation
        ) then ((
          with
            info := (
              if __subject__ is MultiplicationTranslationProject
                then (prefix := 8, startingOffset := 201)
              else (
                  prefix := (
                    assert_exists(
                      __subject__.primaryLocation.fundingAccount,
                      message := "Project must have a primary location"
                    ).accountNumber
                  ),
                  startingOffset := 11
                )
              ),
            select min(
              <str>range_unpack(range(info.prefix * 10000 + info.startingOffset, info.prefix * 10000 + 9999))
              except detached Project.departmentId
            )
          )) else .departmentId
      );
    };
    
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
    
    multi link members := .<project[is Project::Member];
    single link membership := (select .members filter .user = global default::currentUser limit 1);
    
#     multi link engagements := .<project[is Engagement];
    property engagementTotal := count(.<project[is Engagement]);
    
    primaryLocation: Location;
    trigger enforceFundingAccount after update for each do (
      assert(
        any(__new__.primaryLocation.fundingAccount.accountNumber > 0)
          or not exists __new__.primaryLocation, # allow clearing
        message := "Project must have a primary location with a specified funding account"
      )
    );
    marketingLocation: Location;
    multi otherLocations: Location;
    fieldRegion: FieldRegion;
    marketingRegionOverride: FieldRegion;
    
    link rootDirectory: Directory;
    
    partnerships := .<project[is Partnership];
    
    overloaded link projectContext: Project::Context {
      default := (insert Project::Context {
        # https://github.com/edgedb/edgedb/issues/3960
        # projects := {__subject__},
      });
      on source delete delete target;
    }
    
    trigger createBudgetOnInsert after insert for each do (
      insert default::Budget {
        createdAt := datetime_of_statement(),
        modifiedAt := datetime_of_statement(),
        createdBy := assert_exists(global currentActor),
        modifiedBy := assert_exists(global currentActor),
        project := __new__,
        projectContext := __new__.projectContext,
      }
    );
  }
  
  abstract type TranslationProject extending Project {
    multi link engagements := .<project[is LanguageEngagement];
    multi link languages := .engagements.language;
    
    trigger confirmProjectSens after update for each do (
      assert(
        __new__.ownSensitivity = max(__new__.languages.ownSensitivity) ?? Sensitivity.High,
        message := "TranslationProject sensitivity is automatically set to \
          (and required to be) the highest sensitivity Language engaged"
      )
    );
  }

  type MomentumTranslationProject extending TranslationProject;
  type MultiplicationTranslationProject extending TranslationProject;
  
  type InternshipProject extending Project {
    multi link engagements := .<project[is InternshipEngagement];
  }
}
 
module Project {
  abstract type Child extending default::Resource, ContextAware {
    annotation description := "\
      A type that is a child of a project. \
      It will always have a reference to a single project that it is under.";
    
    required project: default::Project {
      readonly := true;
      on target delete delete source;
    };
    
    trigger enforceCorrectProjectContext after insert, update for each do (
      assert(
        __new__.projectContext = __new__.project.projectContext,
        message := "Given project context must match given project's context"
      )
    );
  }
  
  abstract type ContextAware {
    annotation description := "\
      A type that has a project context, which allows it to be
      aware of the sensitivity & current user membership for the associated context.";
    
    required projectContext: Context {
      on target delete delete source;
    }
    index on (.projectContext);
    
    optional ownSensitivity: default::Sensitivity {
      annotation description := "\
        A writable source of a sensitivity. \
        This doesn't necessarily mean it be the same as .sensitivity, which is what is used for authorization.";
    };
    
    required single property sensitivity :=
      max(.projectContext.projects.ownSensitivity)
      ?? (.ownSensitivity ?? default::Sensitivity.High);
    required single property isMember := exists .projectContext.projects.membership;
  }
  
  scalar type Type extending enum<
    MomentumTranslation,
    MultiplicationTranslation,
    Internship
  >;

  type FinancialApprover {
    required user: default::User {
      constraint exclusive;
    };
    required multi projectTypes: Type;
  }
  
  type Context {
    annotation description := "\
      A type that holds a reference to a list of projects. \
      This allows multiple objects to hold a reference to the same list. \
      For example, Language & Ethnologue::Language share the same context / project list.";
    
    multi projects: default::Project {
      on target delete allow;
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
