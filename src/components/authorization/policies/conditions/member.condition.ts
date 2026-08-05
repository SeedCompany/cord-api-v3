import { type NonEmptyArray } from '@seedcompany/common';
import { type Query } from 'cypher-query-builder';
import { type SQL, sql } from 'drizzle-orm';
import { intersection } from 'lodash';
import { inspect, type InspectOptionsStylized } from 'util';
import { type EnhancedResource, type ResourceShape, type Role } from '~/common';
import { matchProjectScopedRoles } from '~/core/neo4j/query';
import { rolesForScope, type ScopedRole, splitScope } from '../../dto/role.dto';
import {
  type AsCypherParams,
  type AsDrizzleParams,
  type AsEdgeQLParams,
  type Condition,
  eqlDoesIntersect,
  fqnRelativeTo,
  type IsAllowedParams,
  MissingContextException,
} from '../../policy/conditions';

const CQL_VAR = 'membershipRoles';

const ScopedRoles = Symbol('ScopedRoles');

export type HasScope =
  // Make non-nullable to enforce that resource has its own scope to use this condition.
  { scope?: readonly ScopedRole[] } | { [ScopedRoles]: readonly ScopedRole[] };

// TODO-ing any here as this hasn't been implemented in some cases yet. #2566
type ResourceWithScope = ResourceShape<HasScope | any>;

class MemberCondition<
  TResourceStatic extends ResourceWithScope,
> implements Condition<TResourceStatic> {
  isAllowed({ object }: IsAllowedParams<TResourceStatic>): boolean {
    return getScope(object).includes('member:true');
  }

  asCypherCondition(
    _query: Query,
    { resource }: AsCypherParams<TResourceStatic>,
  ) {
    // The User/Unavailability list queries bind no `project` variable, and
    // Neo4j 5 rejects pattern expressions that introduce one (42N29). An
    // anonymous start node keeps the "member of ANY project" semantics
    // (matching the Drizzle arm's User/Unavailability branch) without
    // introducing a variable.
    if (resource.name === 'User' || resource.name === 'Unavailability') {
      return 'exists(()-[:member { active: true }]->(:ProjectMember)-[:user]->(:User { id: $currentUser }))';
    }
    return 'exists((project)-[:member { active: true }]->(:ProjectMember)-[:user]->(:User { id: $currentUser }))';
  }

  asDrizzleCondition({ resource, session }: AsDrizzleParams<TResourceStatic>) {
    // Resources that aren't project-scoped rows need bespoke membership SQL —
    // each mirrors its Neo4j list query's `wrapContext` pattern (see the
    // corresponding *.repository.ts) instead of a `project_id` column ref.
    //
    // Deliberate tightening vs the cypher, all arms: `pm.inactive_at is null`
    // excludes replaced/inactive memberships that Neo4j's
    // `[:member { active: true }]` still honors (the rel stays active; only
    // inactiveAt is set). Matches membership-scope semantics. Recorded in the
    // pre-cutover audit ledger — do not loosen to match Neo4j.
    switch (resource.name) {
      case 'Partner':
        // partner.repository.ts list(): member of any project connected via a
        // partnership. Deliberate tightenings vs the cypher: soft-deleted
        // partnerships and soft-deleted projects don't grant membership here
        // (Neo4j severs deleted projects via label rewrites; PG must correlate
        // liveness explicitly).
        return sql`exists (
          select 1 from "partnerships" "ps"
          join "projects" "pj" on "pj"."id" = "ps"."project_id"
            and "pj"."deleted_at" is null
          join "project_members" "pm" on "pm"."project_id" = "ps"."project_id"
          where "ps"."partner_id" = "partners"."id"
            and "ps"."deleted_at" is null
            and "pm"."user_id" = ${session.userId}
            and "pm"."inactive_at" is null
            and "pm"."deleted_at" is null
        )`;
      case 'Organization':
        // organization.repository.ts list(): the partner chain extended one
        // hop (project → partnership → partner → organization).
        return sql`exists (
          select 1 from "partners" "p"
          join "partnerships" "ps" on "ps"."partner_id" = "p"."id"
          join "projects" "pj" on "pj"."id" = "ps"."project_id"
            and "pj"."deleted_at" is null
          join "project_members" "pm" on "pm"."project_id" = "ps"."project_id"
          where "p"."organization_id" = "organizations"."id"
            and "p"."deleted_at" is null
            and "ps"."deleted_at" is null
            and "pm"."user_id" = ${session.userId}
            and "pm"."inactive_at" is null
            and "pm"."deleted_at" is null
        )`;
      case 'User':
      case 'Unavailability':
        // Neo4j's user list binds no `project` variable, so the cypher is
        // existentially unbound = "requester is an active member of ANY
        // project" — a requester property, uncorrelated with the target row.
        // This arm intentionally matches Neo4j. The EdgeQL stub for User is an
        // always-true TODO (`exists { "…" }` over a literal set) — a known
        // Gel-vs-PG divergence for the shadow-diff audit, not parity.
        return sql`exists (
          select 1 from "project_members" "pm"
          where "pm"."user_id" = ${session.userId}
            and "pm"."inactive_at" is null
            and "pm"."deleted_at" is null
        )`;
      default:
        break; // project-scoped resources fall through to the ref map below
    }
    const projectIdRef = projectIdRefForResource(resource);
    return sql`exists (
      select 1 from "project_members" "pm"
      where "pm"."project_id" = ${projectIdRef}
        and "pm"."user_id" = ${session.userId}
        and "pm"."inactive_at" is null
        and "pm"."deleted_at" is null
    )`;
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

  union(this: void, conditions: NonEmptyArray<this>) {
    return conditions[0];
  }

  intersect(this: void, conditions: NonEmptyArray<this>) {
    return conditions[0];
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return 'Member';
  }
}

class MemberWithRolesCondition<
  TResourceStatic extends ResourceWithScope,
> implements Condition<TResourceStatic> {
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

  asDrizzleCondition({ resource, session }: AsDrizzleParams<TResourceStatic>) {
    const projectIdRef = projectIdRefForResource(resource);
    // ARRAY[...]::role[] intersection — true when membership shares at least
    // one role with the required set. Mirrors `apoc.coll.intersection` >0 in
    // Cypher and `intersect` in EdgeQL.
    const requiredRoles = sql.raw(
      `array[${this.roles.map((r) => `'${r}'`).join(', ')}]::"role"[]`,
    );
    return sql`exists (
      select 1 from "project_members" "pm"
      where "pm"."project_id" = ${projectIdRef}
        and "pm"."user_id" = ${session.userId}
        and "pm"."inactive_at" is null
        and "pm"."deleted_at" is null
        and "pm"."roles" && ${requiredRoles}
    )`;
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
 * Resolve the SQL fragment that locates the parent project's `id` for the
 * given resource. Project subtypes (Momentum/Multiplication/Internship)
 * dereference to `projects.id` directly. Project-scoped child resources
 * reference their FK column. Add cases here as each domain ports to Postgres.
 */
// migration-todo: the project-scoped base arms below (and the sensitivity
// subselects) don't correlate `projects.deleted_at`, so members of a
// soft-deleted project retain access to its child rows under PG — Neo4j
// severs these chains via Deleted_ label rewrites. The bespoke Partner/Org
// arms above DO join project liveness. Disposition for the rest at the
// pre-cutover audit: liveness joins per-arm, or cascade project soft-delete
// to project_members/partnerships.
const projectIdRefForResource = (resource: EnhancedResource<any>): SQL => {
  switch (resource.name) {
    case 'Project':
    case 'TranslationProject':
    case 'MomentumTranslationProject':
    case 'MultiplicationTranslationProject':
    case 'InternshipProject':
      return sql.raw(`"projects"."id"`);
    case 'ProjectMember':
      return sql.raw(`"project_members"."project_id"`);
    case 'ProjectWorkflowEvent':
      return sql.raw(`"project_workflow_events"."project_id"`);
    case 'Partnership':
      return sql.raw(`"partnerships"."project_id"`);
    case 'Budget':
      return sql.raw(`"budgets"."project_id"`);
    case 'BudgetRecord':
      return sql.raw(
        `(select "b"."project_id" from "budgets" "b" where "b"."id" = "budget_records"."budget_id")`,
      );
    case 'Engagement':
    case 'LanguageEngagement':
    case 'InternshipEngagement':
      return sql.raw(`"engagements"."project_id"`);
    case 'Ceremony':
      return sql.raw(
        `(select "e"."project_id" from "engagements" "e" where "e"."id" = "ceremonies"."engagement_id")`,
      );
    case 'Language':
      // A language is "member-visible" through ANY project engaging it.
      // `pm.project_id = any(array(...))` keeps the shared `= ${ref}` template
      // working with a multi-row subquery.
      return sql.raw(
        `any(array(select "e"."project_id" from "engagements" "e"
          where "e"."language_id" = "languages"."id" and "e"."deleted_at" is null))`,
      );
    // migration-todo: re-add a case per domain as it ports to Postgres
    // (Engagement/Ceremony/Language each dereference to
    // their `project_id` FK — mono has the arms). Kept stripped so an
    // unmigrated domain routed through Drizzle fails loud here instead of
    // emitting SQL against a non-existent table.
    //
    // Partner/Organization/User are NOT project-scoped rows — their member
    // checks are bespoke EXISTS branches in asDrizzleCondition above, not
    // project_id refs here.
    default:
      throw new Error(
        `MemberCondition.asDrizzleCondition: resource ${resource.name} not configured for Drizzle yet; add a case when it migrates.`,
      );
  }
};

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
    throw new MissingContextException(
      "Needed object's scoped roles but object wasn't given",
    );
  }

  return Reflect.get(object, ScopedRoles) ?? Reflect.get(object, 'scope') ?? [];
};
