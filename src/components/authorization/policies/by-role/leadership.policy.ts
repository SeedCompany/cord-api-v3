import { allowAll, Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Leadership, allowAll('read'))
export class LeadershipPolicy {}
