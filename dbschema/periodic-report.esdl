module default {
  abstract type PeriodicReport extending Engagement::Child {
    # https://github.com/edgedb/edgedb/issues/6766
    # overloaded engagement: LanguageEngagement;

    required `start`: cal::local_date;
    required `end`: cal::local_date;

    receivedDate: cal::local_date;

    skippedReason: str;

    reportFile: File;
  }

  type FinancialReport extending PeriodicReport {}
  type NarrativeReport extending PeriodicReport {}
}