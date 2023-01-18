import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Controller, (r) => [
  // keep multiline format
  r.Organization.delete,
  r.Partner.delete,
])
export class ControllerPolicy {}
