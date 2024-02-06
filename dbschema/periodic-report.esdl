module default {
  abstract type PeriodicReport extending Resource, Mixin::Embedded {
    required `start`: cal::local_date;
    required `end`: cal::local_date;

    receivedDate: cal::local_date;

    skippedReason: str;

    reportFile: File;
  }

  type FinancialReport extending PeriodicReport, Project::Child {
    overloaded container: Project;
  }

  type NarrativeReport extending PeriodicReport, Project::Child {
    overloaded container: Project;
  }

  type ProgressReport extending PeriodicReport, Engagement::Child {
    overloaded container: Engagement;
  }
}
