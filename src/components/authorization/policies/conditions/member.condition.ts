import { Query } from 'cypher-query-builder';
import { intersection } from 'lodash';
import { inspect, InspectOptionsStylized } from 'util';
import { ResourceShape } from '~/common';
import { matchProjectScopedRoles, variable } from '~/core/database/query';
import {
  Role,
  rolesForScope,
  ScopedRole,
  splitScope,
} from '../../dto/role.dto';
import {
  AsCypherParams,
  Condition,
  IsAllowedParams,
} from '../../policy/conditions';

const CQL_VAR = 'membershipRoles';

class MemberCondition<
  TResourceStatic extends ResourceShape<any> & {
    // Make non-nullable to enforce that resource has its own scope to use this condition.
    prototype: { scope?: readonly ScopedRole[] };
  }
> implements Condition<TResourceStatic>
{
  constructor(private readonly roles?: readonly Role[]) {}

  isAllowed({ object }: IsAllowedParams<TResourceStatic>): boolean {
    if (!object) {
      throw new Error("Needed object's scoped roles but object wasn't given");
    }

    const scope: ScopedRole[] =
      Reflect.get(object, ScopedRoles) ?? object?.scope ?? [];

    if (!this.roles) {
      return scope.includes('member:true');
    }

    const actual = scope
      .map(splitScope)
      .filter(([scope, _]) => scope === 'project')
      .map(([_, role]) => role);
    return intersection(this.roles, actual).length > 0;
  }

  setupCypherContext(
    query: Query,
    prevApplied: Set<any>,
    other: AsCypherParams<TResourceStatic>
  ) {
    const cacheKey = this.roles ? 'membership-roles' : 'membership';
    if (prevApplied.has(cacheKey)) {
      return query;
    }
    prevApplied.add(cacheKey);

    if (!this.roles) {
      const param = query.params.addParam(
        other.session.userId,
        'requestingUser'
      );
      Reflect.set(other, CQL_VAR, param);
      return query;
    }

    return query.apply(
      matchProjectScopedRoles({
        session: variable('requestingUser'),
        outputVar: CQL_VAR,
      })
    );
  }

  asCypherCondition(query: Query, other: AsCypherParams<TResourceStatic>) {
    if (!this.roles) {
      const requester = String(Reflect.get(other, CQL_VAR));
      return `exists((project)-[:member { active: true }]->(:ProjectMember)-[:user]->(:User { id: ${requester} }))`;
    }

    const required = query.params.addParam(
      this.roles.map(rolesForScope('project')),
      'requiredMemberRoles'
    );
    return `size(apoc.coll.intersection(${CQL_VAR}, ${String(required)})) > 0`;
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return 'Member';
  }
}

/**
 * The following actions only apply if the requester has any "member" scoped roles.
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
