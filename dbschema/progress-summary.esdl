module default {
  type ProgressSummary {
    required planned: float32;
    required actual: float32;
    
    totalVerses: int16;
    totalVerseEquivalents: int16;
  }
}


module ProgressSummary {
  scalar type Period extending enum<
    ReportPeriod,
    FiscalYearSoFar,
    Cumulative,
  >;
}
