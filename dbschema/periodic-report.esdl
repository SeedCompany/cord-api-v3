module default {
  abstract type PeriodicReport extending Resource, Mixin::Embedded {
    required period: range<cal::local_date>;
    `start` := range_get_lower(.period);

    # Adjust for `range_get_upper` giving next day: subtract 1 from day manually
    # due to `cal::to_local_date` arithmetic error.
    # See: https://github.com/edgedb/edgedb/issues/6786
    `end` := (
      with
        e := range_get_upper(.period)
        select cal::to_local_date(
          <int64>cal::date_get(e, 'year'),
          <int64>cal::date_get(e, 'month'),
          <int64>cal::date_get(e, 'day') - 1,
        )
    );

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
}
