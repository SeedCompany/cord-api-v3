import { Role } from './dto';
import { AssignableRoles } from './dto/assignable-roles';
import { Granter, ResourceGranter } from './policy';

@Granter(AssignableRoles)
export class AssignableRolesGranter extends ResourceGranter<
  typeof AssignableRoles
> {
  grant(allowed: readonly Role[]) {
    return this.specifically((p) => p.many(...allowed).edit);
  }
}

declare module './policy/granters' {
  interface GrantersOverride {
    AssignableRoles: AssignableRolesGranter;
  }
}
