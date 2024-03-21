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
  AsEdgeQLParams,
  Condition,
  eqlDoesIntersect,
  fqnRelativeTo,
  IsAllowedParams,
} from '../../policy/conditions';

const CQL_VAR = 'membershipRoles';

const ScopedRoles = Symbol('ScopedRoles');

export type HasScope =
  // Make non-nullable to enforce that resource has its own scope to use this condition.
  { scope?: readonly ScopedRole[] } | { [ScopedRoles]: readonly ScopedRole[] };

// TODO-ing any here as this hasn't been implemented in some cases yet. #2566
type ResourceWithScope = ResourceShape<HasScope | any>;

class MemberCondition<TResourceStatic extends ResourceWithScope>
  implements Condition<TResourceStatic>
{
  isAllowed({ object }: IsAllowedParams<TResourceStatic>): boolean {
    return getScope(object).includes('member:true');
  }

  setupCypherContext(
    query: Query,
    prevApplied: Set<any>,
    other: AsCypherParams<TResourceStatic>,
  ) {
    if (prevApplied.has('membership')) {
      return query;
    }
    prevApplied.add('membership');

    const param = query.params.addParam(other.session.userId, 'requestingUser');
    Reflect.set(other, CQL_VAR, param);
    return query;
  }

  asCypherCondition(query: Query, other: AsCypherParams<TResourceStatic>) {
    const requester = String(Reflect.get(other, CQL_VAR));
    return `exists((project)-[:member { active: true }]->(:ProjectMember)-[:user]->(:User { id: ${requester} }))`;
  }

  setupEdgeQLContext({
    resource,
  }: AsEdgeQLParams<TResourceStatic>): Record<string, string> {
    return resource.isEmbedded
      ? { isMember: '(.container[is Project::ContextAware].isMember ?? false)' }
      : {};
  }

  asEdgeQLCondition({ resource }: AsEdgeQLParams<TResourceStatic>) {
    if (resource.name === 'User' || resource.name === 'Unavailability') {
      return 'exists { "Stubbed .isMember for User/Unavailability" }'; // TODO
    }
    return resource.isEmbedded ? 'isMember' : '.isMember';
  }

  union(this: void, conditions: this[]) {
    return conditions[0];
  }

  intersect(this: void, conditions: this[]) {
    return conditions[0];
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return 'Member';
  }
}

class MemberWithRolesCondition<TResourceStatic extends ResourceWithScope>
  implements Condition<TResourceStatic>
{
  constructor(private readonly roles: readonly Role[]) {}

  isAllowed({ object }: IsAllowedParams<TResourceStatic>): boolean {
    const actual = getScope(object)
      .map(splitScope)
      .filter(([scope, _]) => scope === 'project')
      .map(([_, role]) => role);
    return intersection(this.roles, actual).length > 0;
  }

  setupCypherContext(query: Query, prevApplied: Set<any>) {
    if (prevApplied.has('membership-roles')) {
      return query;
    }
    prevApplied.add('membership-roles');

    return query.apply(
      matchProjectScopedRoles({
        session: variable('requestingUser'),
        outputVar: CQL_VAR,
      }),
    );
  }

  asCypherCondition(query: Query) {
    const required = query.params.addParam(
      this.roles.map(rolesForScope('project')),
      'requiredMemberRoles',
    );
    return `size(apoc.coll.intersection(${CQL_VAR}, ${String(required)})) > 0`;
  }

  asEdgeQLCondition({ namespace }: AsEdgeQLParams<TResourceStatic>) {
    const Role = fqnRelativeTo('default::Role', namespace);
    return eqlDoesIntersect('.membership.roles', this.roles, Role);
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return `Member with ${this.roles.join(', ')}`;
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
export const memberWith = (...roles: Role[]) =>
  new MemberWithRolesCondition(roles);

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
  }) as T & { [ScopedRoles]: ScopedRole[] };

export const getScope = (object?: HasScope): ScopedRole[] => {
  if (!object) {
    throw new Error("Needed object's scoped roles but object wasn't given");
  }

  return Reflect.get(object, ScopedRoles) ?? Reflect.get(object, 'scope') ?? [];
};
