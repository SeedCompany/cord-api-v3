import { BetaFeatures, Policy, Role } from '../util';

@Policy(
  [
    Role.Administrator,
    Role.FieldOperationsDirector,
    Role.RegionalDirector,
    // TODO Who else?
  ],
  (r) => BetaFeatures.grant(r, 'projectChangeRequests')
)
export class ProjectChangeRequestsBetaPolicy {}
