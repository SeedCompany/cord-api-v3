import { Policy, Role } from '../util';

@Policy(
  [
    Role.Administrator,
    Role.FieldOperationsDirector,
    Role.RegionalDirector,
    // TODO Who else?
  ],
  (r) => [r.BetaFeatures.specifically((p) => [p.projectChangeRequests.edit])]
)
export class ProjectChangeRequestsBetaPolicy {}
