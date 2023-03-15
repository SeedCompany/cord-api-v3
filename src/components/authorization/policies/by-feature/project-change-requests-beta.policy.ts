import { Policy, Role } from '../util';

@Policy(
  [
    Role.Administrator,
    Role.FieldOperationsDirector,
    Role.RegionalDirector,
    // TODO Who else?
  ],
  (r) => r.BetaFeatures.grant('projectChangeRequests'),
)
export class ProjectChangeRequestsBetaPolicy {}
