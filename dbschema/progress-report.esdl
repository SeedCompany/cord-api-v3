module default {
  type ProgressReport extending PeriodicReport, Engagement::Child {
    overloaded container: LanguageEngagement;
    overloaded engagement: LanguageEngagement;
  }
}

module ProgressReport {
   abstract type Child extending Engagement::Child, Project::ContextAware {
    annotation description := "\
      A type that is a child of a progress report. \

      It will always have a reference to a single progress report and engagement that it is under.";
    
    required progressReport: default::ProgressReport {
      readonly := true;
      on target delete delete source;
    };
    
    trigger enforceProgressReportEngagement after insert, update for each do (
      assert(
        __new__.progressReport.engagement = __new__.engagement,
        message := "Given progress report must be for the same engagement as the given engagement"
      )
    );
  }
}
