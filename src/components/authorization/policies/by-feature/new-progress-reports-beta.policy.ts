import { Policy, Role } from '../util';

@Policy(
  [
    Role.Administrator,
    Role.FieldOperationsDirector,
    Role.RegionalDirector,
    Role.RegionalCommunicationsCoordinator,
    Role.ProjectManager,
    Role.Marketing,
  ],
  (r) => r.BetaFeatures.grant('newProgressReports')
)
export class NewProgressReportsPolicy {}
