import { Policy, Role } from '../util';

@Policy(
  [
    Role.Administrator,
    Role.FieldOperationsDirector,
    Role.RegionalDirector,
    Role.RegionalCommunicationsCoordinator,
    // TODO Who else?
  ],
  (r) => r.BetaFeatures.grant('newProgressReports')
)
export class NewProgressReportsPolicy {}
