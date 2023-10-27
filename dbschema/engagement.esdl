module default {
  abstract type Engagement extending Project::Resource {
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

    completedDate: cal::local_date {
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

    description: json;
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

    required lukePartnership: bool {
      default := false;
    };
    required openToInvestorVisit: bool {
      default := false;
    };
    paratextRegistryId: str;
#     pnp: File;

    sentPrintingDate: cal::local_date {
      annotation deprecated := "Legacy data";
    };
    historicGoal: str {
      annotation deprecated := "Legacy data";
    }

    # I want ceremony to be automatically created when engagement is created.
    # Using computed & trigger to do this, because properties with default expressions
    # cannot refer to links of inserted object.
    # Aka a default expression cannot pass the project for the engagement through to the ceremony.
    trigger connectDedicationCeremony after insert for each do (
      insert Engagement::DedicationCeremony {
        createdAt := datetime_of_statement(),
        engagement := __new__,
        project := __new__.project,
      }
    );
  }

  type InternshipEngagement extending Engagement {
    overloaded required project: InternshipProject;

    required intern: User {
      readonly := true;
    }
    constraint exclusive on ((.project, .intern));

    mentor: User;
#     position: Engagement::InternPosition;
#     multi methodologies: ProductMethodology;
#     countryOfOrigin: Location;
#     growthPlan: File;

    trigger connectCertificationCeremony after insert for each do (
      insert Engagement::CertificationCeremony {
        createdAt := datetime_of_statement(),
        engagement := __new__,
        project := __new__.project,
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

  abstract type Resource extending Project::Resource {
    required engagement: default::Engagement {
      readonly := true;
      on target delete delete source;
    };

    # Not yet supported
    # overloaded required project: default::Project {
    #   default := .engagement.project;
    # };
  }
}
