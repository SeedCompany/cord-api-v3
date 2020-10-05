import { Powers } from '../dto/powers';
import { AnyBaseNode } from './any-base-node';
import { DbBaseNodeGrant } from './base-node-grant.model.db';
import { DbPermission } from './permission.model.db';

export class DbRole {
  name: string;
  powers: Powers[];
  grants: Array<DbBaseNodeGrant<AnyBaseNode>>;

  constructor({
    name,
    powers,
    grants,
  }: {
    name: string;
    powers: Powers[];
    grants: Array<DbBaseNodeGrant<AnyBaseNode>>;
  }) {
    this.name = name;
    this.powers = powers;
    this.grants = grants;
  }

  getPermissionsOnProperty<T>(
    type: T,
    prop: keyof T
  ): DbPermission | undefined {
    const grant = this.grants.find((element) => typeof element === typeof type);

    const perms = grant?.properties.find(
      (element) => element.propertyName === prop
    );

    return perms?.permission;
  }
}
