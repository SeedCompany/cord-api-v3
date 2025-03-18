module default {
  abstract type PeriodicReport extending Resource, Mixin::Embedded {
    required period: range<cal::local_date>;
    `start` := range_get_lower(.period);
    `end` := date_range_get_upper(.period);
    
    skippedReason: str;
    
    reportFile: File;
    receivedDate: cal::local_date;
  }
  
  type FinancialReport extending PeriodicReport, Project::Child {
    overloaded container: Project;
  }
  
  type NarrativeReport extending PeriodicReport, Project::Child {
    overloaded container: Project;
  }
}
