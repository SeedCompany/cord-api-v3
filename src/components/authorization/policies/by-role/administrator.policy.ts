import { allowAll, Policy, Role } from '../util';

@Policy(Role.Administrator, allowAll('read', 'edit', 'create', 'delete'))
export class AdministratorPolicy {}
