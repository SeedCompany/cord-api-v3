import { intersection } from 'lodash';
import { ResourceShape } from '~/common';
import { Role, ScopedRole, splitScope } from '../../dto/role.dto';
import { Condition, IsAllowedParams } from '../../policy/conditions';

class MemberCondition<
  TResourceStatic extends ResourceShape<any> & {
    // Make non-nullable to enforce that resource has its own scope to use this condition.
    prototype: { scope?: readonly ScopedRole[] };
  }
> implements Condition<TResourceStatic>
{
  constructor(private readonly roles?: Role[]) {}

  isAllowed({ object, policy }: IsAllowedParams<TResourceStatic>): boolean {
    const expected = this.roles ?? policy.roles;

    const scope: ScopedRole[] = object?.scope ?? [];
    const actual = scope
      .map(splitScope)
      .filter(([scope, _]) => scope === 'project')
      .map(([_, role]) => role);

    // If policy is for any roles, just confirm that there's at least one member role.
    if (!expected) {
      return actual.length > 0;
    }

    return intersection(expected, actual).length > 0;
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
