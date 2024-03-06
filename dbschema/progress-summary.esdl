module default {
  type ProgressSummary {
    required planned: float32;
    required actual: float32;
    
    required report: ProgressReport; 
    required period: ProgressSummary::Period;
    
    totalVerses: int16;
    totalVerseEquivalents: float32;
    
    constraint exclusive on ((.report, .period));
  }
}

module ProgressSummary {
  scalar type Period extending enum<
    ReportPeriod,
    FiscalYearSoFar,
    Cumulative,
  >;
}
