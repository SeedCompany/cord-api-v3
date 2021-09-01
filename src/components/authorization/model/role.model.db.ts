import { ResourceShape, SecuredResource } from '../../../common';
import { ScopedRole } from '../dto';
import { Powers } from '../dto/powers';
import { AnyBaseNode } from './any-base-node.type';
import { DbBaseNodeGrant } from './base-node-grant.model.db';
import { DbPermission } from './permission.model.db';

// An object defining the permissions for each property of the resource
export type PermissionsForResource<Resource extends ResourceShape<any>> =
  Partial<Record<keyof SecuredResource<Resource>, DbPermission>>;

export class DbRole {
  name: ScopedRole;
  powers: Powers[];
  grants: Array<DbBaseNodeGrant<AnyBaseNode>>;

  constructor({
    ...rest
  }: {
    name: ScopedRole;
    powers: Powers[];
    grants: Array<DbBaseNodeGrant<AnyBaseNode>>;
  }) {
    Object.assign(this, rest);
  }
}
