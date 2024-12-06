module default {
  abstract type Engagement extending Project::Child, Comments::Aware {
    required status: Engagement::Status {
      default := Engagement::Status.InDevelopment;
    }
    statusModifiedAt: datetime {
      rewrite update using (datetime_of_statement() if .status != __old__.status else .statusModifiedAt);
    }
    lastSuspendedAt: datetime {
      rewrite update using (datetime_of_statement()
        if .status != __old__.status
            and .status = Engagement::Status.Suspended
        else .lastSuspendedAt);
    }
    lastReactivatedAt: datetime {
      rewrite update using (datetime_of_statement()
        if .status != __old__.status
          and .status = Engagement::Status.Active
          and __old__.status = Engagement::Status.Suspended
        else .lastReactivatedAt);
    }
    
    required single link ceremony := assert_exists(assert_single(
      .<engagement[is Engagement::Ceremony]
    ));
    
    completeDate: cal::local_date {
      annotation description := "Translation / Growth Plan complete date";
    }
    disbursementCompleteDate: cal::local_date;
    
    startDateOverride: cal::local_date;
    endDateOverride: cal::local_date;
    property startDate := .startDateOverride ?? .project.mouStart;
    property endDate := .endDateOverride ?? .project.mouEnd;
    property initialEndDate: cal::local_date {
      rewrite insert, update using (.endDate if .status = Engagement::Status.InDevelopment else .initialEndDate);
    };
    
    description: RichText;
  }
  
  type LanguageEngagement extending Engagement {
    overloaded required project: TranslationProject;
    
    required language: Language {
      readonly := true;
    }
    constraint exclusive on ((.project, .language));
    
    property firstScripture := (
      exists .language.firstScriptureEngagement
    );

    trigger denyDuplicateFirstScriptureBasedOnExternal after insert, update for each do ( 
      assert(
        not __new__.firstScripture or not exists __new__.language.hasExternalFirstScripture,
        message := "First scripture has already been marked as having been done externally"
      )
    );
    trigger denyDuplicateFirstScriptureBasedOnOtherEngagement after insert, update for each do (
      assert( 
        not exists (select __new__.language.engagements filter .firstScripture),
        message := "Another engagement has already been marked as having done the first scripture"
      )
    );

    required lukePartnership: bool {
      default := false;
    };
    required openToInvestorVisit: bool {
      default := false;
    };
    paratextRegistryId: str;
    pnp: File;
    
    sentPrintingDate: cal::local_date {
      annotation deprecated := "Legacy data";
    };
    historicGoal: str {
      annotation deprecated := "Legacy data";
    }

    milestoneReached: Language::Milestone {
       default := Language::Milestone.None;
    };
    
    # I want ceremony to be automatically created when engagement is created.
    # Using computed & trigger to do this, because properties with default expressions
    # cannot refer to links of inserted object.
    # Aka a default expression cannot pass the project for the engagement through to the ceremony.
    trigger connectDedicationCeremony after insert for each do (
      insert Engagement::DedicationCeremony {
        createdAt := datetime_of_statement(),
        modifiedAt := datetime_of_statement(),
        createdBy := assert_exists(global currentActor),
        modifiedBy := assert_exists(global currentActor),
        engagement := __new__,
        project := __new__.project,
        projectContext := __new__.projectContext,
      }
    );
    
    trigger recalculateProjectSensOnInsert after insert for each do (
      update (
        select __new__.project
        # Filter out projects without change, so modifiedAt isn't bumped
        filter .ownSensitivity != max(.languages.ownSensitivity) ?? Sensitivity.High
      )
      set { ownSensitivity := max(.languages.ownSensitivity) ?? Sensitivity.High }
    );
    trigger recalculateProjectSensOnDelete after delete for each do (
      with removedLang := __old__.language
      update (
        select __old__.project
        # Filter out projects without change, so modifiedAt isn't bumped
        filter .ownSensitivity != max((.languages except removedLang).ownSensitivity) ?? Sensitivity.High
      )
      set { ownSensitivity := max((.languages except removedLang).ownSensitivity) ?? Sensitivity.High }
    );
    
    trigger addProjectToContextOfLanguage after insert for each do (
      update __new__.language.projectContext
      set { projects += __new__.project }
    );
    trigger removeProjectFromContextOfLanguage after delete for each do (
      update __old__.language.projectContext
      set { projects -= __old__.project }
    );
  }
  
  type InternshipEngagement extending Engagement {
    overloaded required project: InternshipProject;
    
    required intern: User {
      readonly := true;
    }
    constraint exclusive on ((.project, .intern));
    
    mentor: User;
    position: Engagement::InternPosition;
    multi methodologies: Product::Methodology;
    countryOfOrigin: Location;
    growthPlan: File;
    
    trigger connectCertificationCeremony after insert for each do (
      insert Engagement::CertificationCeremony {
        createdAt := datetime_of_statement(),
        modifiedAt := datetime_of_statement(),
        createdBy := assert_exists(global currentActor),
        modifiedBy := assert_exists(global currentActor),
        engagement := __new__,
        project := __new__.project,
        projectContext := __new__.projectContext,
      }
    );
  }
}
 
module Engagement {
  scalar type Status extending enum<
    InDevelopment,
    DidNotDevelop,
    Rejected,
    
    Active,
    
    DiscussingTermination,
    DiscussingReactivation,
    DiscussingChangeToPlan,
    DiscussingSuspension,
    
    FinalizingCompletion,
    ActiveChangedPlan,
    Suspended,
    
    Terminated,
    Completed,
    
    # deprecated / legacy
    Converted,
    Unapproved,
    Transferred,
    NotRenewed,
  >;
  
  scalar type InternPosition extending enum<
    ConsultantInTraining,
    MidLevelQualityAssurance,
    LeadershipDevelopment,
    Mobilization,
    Personnel,
    Communication,
    Administration,
    Technology,
    Finance,
    LanguageProgramManager,
    Literacy,
    OralityFacilitator,
    ScriptureEngagement,
    OtherAttached,
    OtherTranslationCapacity,
    OtherPartnershipCapacity,
    ExegeticalFacilitator,
    TranslationFacilitator,
  >;

  abstract type Child extending Project::Child {
    annotation description := "\
      A type that is a child of an engagement. \
      It will always have a reference to a single engagement & project that it is under.";
    
    required engagement: default::Engagement {
      readonly := true;
      on target delete delete source;
    };
    
    trigger enforceEngagementProject after insert, update for each do (
      assert(
        __new__.engagement.project = __new__.project,
        message := "Given engagement must be for the same project as the given project."
      )
    );
    
    # Not yet supported
    # overloaded required project: default::Project {
    #   default := .engagement.project;
    # };
  }
}
