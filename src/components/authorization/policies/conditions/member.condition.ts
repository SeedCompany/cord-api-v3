import { intersection } from 'lodash';
import { inspect, InspectOptionsStylized } from 'util';
import { ResourceShape } from '~/common';
import {
  Role,
  rolesForScope,
  ScopedRole,
  splitScope,
} from '../../dto/role.dto';
import { Condition, IsAllowedParams } from '../../policy/conditions';
import { BuiltPolicy } from '../util';

class MemberCondition<
  TResourceStatic extends ResourceShape<any> & {
    // Make non-nullable to enforce that resource has its own scope to use this condition.
    prototype: { scope?: readonly ScopedRole[] };
  }
> implements Condition<TResourceStatic>
{
  constructor(private readonly roles?: readonly Role[]) {}

  attachPolicy(policy: BuiltPolicy): MemberCondition<TResourceStatic> {
    return this.roles ? this : new MemberCondition(policy.roles);
  }

  isAllowed({ object }: IsAllowedParams<TResourceStatic>): boolean {
    const scope: ScopedRole[] = object[ScopedRoles] ?? object?.scope ?? [];
    const actual = scope
      .map(splitScope)
      .filter(([scope, _]) => scope === 'project')
      .map(([_, role]) => role);

    // If policy is for any roles, just confirm that there's at least one member role.
    if (!this.roles) {
      return actual.length > 0;
    }

    return intersection(this.roles, actual).length > 0;
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    if (this.roles) {
      return `Membership ${inspect({ roles: this.roles })}`;
    }
    return 'Membership';
  }
}

/**
 * The following actions only apply if the requester has any "member" scoped roles
 * with this policy's defined roles.
 * This usually is implemented as a member of the related project.
 */
export const member = new MemberCondition();

/**
 * The following actions only apply if the requester has any "member" scoped
 * roles of the given roles.
 *
 * NOTE that the policy roles are filtered before this, so only a subset of the
 * policy's roles can effectively be used here.
 */
export const memberWith = (...roles: Role[]) => new MemberCondition(roles);

/**
 * Specify roles that should be used for the membership condition.
 */
export const withMembershipRoles = <T extends object>(obj: T, roles: Role[]) =>
  withScope(obj, roles.map(rolesForScope('project')));

/**
 * Specify scoped roles that should be used for the membership condition.
 * This is useful when the object doesn't have a `scope` property or
 * more scoped roles need to be added in for this condition.
 */
export const withScope = <T extends object>(obj: T, roles: ScopedRole[]) =>
  Object.defineProperty(obj, ScopedRoles, {
    value: roles,
    enumerable: false,
  });

const ScopedRoles = Symbol('ScopedRoles');
