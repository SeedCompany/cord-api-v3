import { InternalRole, Role } from '../dto';
import { Powers } from '../dto/powers';
import { AnyBaseNode } from './any-base-node.type';
import { DbBaseNodeGrant } from './base-node-grant.model.db';
import { DbPermission } from './permission.model.db';

export class DbRole {
  name: Role | InternalRole;
  powers: Powers[];
  grants: Array<DbBaseNodeGrant<AnyBaseNode>>;

  constructor({
    ...rest
  }: {
    name: string;
    powers: Powers[];
    grants: Array<DbBaseNodeGrant<AnyBaseNode>>;
  }) {
    Object.assign(this, rest);
  }

  getPermissionsOnProperty<AnyBaseNode>(
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __className: string,
    prop: keyof AnyBaseNode
  ): DbPermission | undefined {
    const grant = this.grants.find(
      (element) => element.__className === __className
    );

    const perms = grant?.properties.find(
      (element) => element.propertyName === prop
    );

    return perms?.permission;
  }
}
