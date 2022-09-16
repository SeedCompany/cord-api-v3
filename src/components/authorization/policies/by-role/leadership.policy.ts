import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Leadership, (r) =>
  Object.values(r).map((resource) => resource.read)
)
export class LeadershipPolicy {}
