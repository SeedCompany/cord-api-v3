import { Powers } from '../dto/powers';
import { AnyBaseNode } from './any-base-node.type';
import { DbBaseNodeGrant } from './base-node-grant.model.db';
import { DbPermission } from './permission.model.db';

export class DbRole {
  name: string;
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
    type: AnyBaseNode,
    prop: keyof AnyBaseNode
  ): DbPermission | undefined {
    const grant = this.grants.find((element) => typeof element === typeof type);

    const perms = grant?.properties.find(
      (element) => element.propertyName === prop
    );

    return perms?.permission;
  }
}
