module default {
  type ProgressReport extending PeriodicReport, Engagement::Child {
    overloaded container: Engagement;
  }
}