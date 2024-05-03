import { allowAll, Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Leadership, (r) => [
  ...allowAll('read')(r),
  r.Project.read.specifically((p) => [p.marketingLocation.edit]),
])
export class LeadershipPolicy {}
