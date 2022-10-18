import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Controller, (r) => [
  r.Organization.edit.create.delete,
  r.Partner.edit.create.delete,
])
export class ControllerPolicy {}
