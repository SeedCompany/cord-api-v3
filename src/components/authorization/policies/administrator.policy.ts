import { Policy, Role } from './util';

@Policy(Role.Administrator, (resources) =>
  Object.values(resources).map((resource) => resource.edit.create.delete)
)
export class AdministratorPolicy {}
