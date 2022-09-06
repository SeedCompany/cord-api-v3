import { Policy, Role } from './util';

@Policy(Role.Administrator, (resources) =>
  Object.values(resources).map((resource) => resource.write.create.delete)
)
export class AdministratorPolicy {}
