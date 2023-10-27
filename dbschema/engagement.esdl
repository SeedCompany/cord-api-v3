module default {
  abstract type Engagement extending Resource {
    required project: Project {
      readonly := true;
      on target delete delete source;
    }

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

    required ceremony: Engagement::Ceremony {
      readonly := true;
      constraint exclusive;
      on source delete delete target;
    }

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

    property sensitivity := .project.sensitivity;

    description: json;
  }

  type LanguageEngagement extending Engagement {
    overloaded required project: TranslationProject;

    required language: Language {
      readonly := true;
    }
    constraint exclusive on ((.project, .language));

    overloaded required ceremony: Engagement::DedicationCeremony {
      default := (insert Engagement::DedicationCeremony {
        createdAt := datetime_of_statement(),
      });
    };

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
  }

  type InternshipEngagement extending Engagement {
    overloaded required project: InternshipProject;

    required intern: User {
      readonly := true;
    }
    constraint exclusive on ((.project, .intern));

    overloaded required ceremony: Engagement::CertificationCeremony {
      default := (insert Engagement::CertificationCeremony {
        createdAt := datetime_of_statement(),
      });
    };

    mentor: User;
#     position: Engagement::InternPosition;
#     multi methodologies: ProductMethodology;
#     countryOfOrigin: Location;
#     growthPlan: File;
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
}
