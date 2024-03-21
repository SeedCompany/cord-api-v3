import { inspect } from 'util';
import { Role } from '~/common';
import { withoutScope } from '../../dto';
import {
  AsEdgeQLParams,
  Condition,
  eqlDoesIntersect,
  fqnRelativeTo,
  IsAllowedParams,
} from '../../policy/conditions';

export class RoleCondition implements Condition {
  constructor(readonly allowed: ReadonlySet<Role>) {}

  isAllowed({ session }: IsAllowedParams<any>) {
    const given = session.roles.map(withoutScope);
    return given.some((role) => this.allowed.has(role));
  }

  asCypherCondition() {
    return 'false';
  }

  setupEdgeQLContext({ namespace }: AsEdgeQLParams<any>) {
    const User = fqnRelativeTo('default::User', namespace);
    const currentUserId = fqnRelativeTo('default::currentUserId', namespace);
    return {
      givenRoles: `(<${User}>(global ${currentUserId})).roles`,
    };
  }

  asEdgeQLCondition({ namespace }: AsEdgeQLParams<any>) {
    const roleType = fqnRelativeTo('default::Role', namespace);
    return eqlDoesIntersect('givenRoles', this.allowed, roleType);
  }

  union(this: void, conditions: this[]) {
    const roles = conditions.flatMap((cond) => [...cond.allowed]);
    return new RoleCondition(new Set(roles));
  }

  intersect(this: void, conditions: this[]) {
    const intersected = [...conditions[0].allowed].filter((v) =>
      conditions.every((cond) => cond.allowed.has(v)),
    );
    return new RoleCondition(new Set(intersected));
  }

  [inspect.custom]() {
    return `Roles { ${[...this.allowed].join(', ')} }`;
  }
}
