import { type NonEmptyArray } from '@seedcompany/common';
import { type SQL, sql } from 'drizzle-orm';
import { intersection } from 'lodash';
import { inspect, type InspectOptionsStylized } from 'util';
import { type EnhancedResource, type ResourceShape, type Role } from '~/common';
import { rolesForScope, type ScopedRole, splitScope } from '../../dto/role.dto';
import {
  type AsDrizzleParams,
  type Condition,
  type IsAllowedParams,
  MissingContextException,
} from '../../policy/conditions';

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

  asDrizzleCondition({ resource, session }: AsDrizzleParams<TResourceStatic>) {
    // Resources that aren't project-scoped rows need bespoke membership SQL
    // instead of a `project_id` column ref.
    //
    // Deliberate tightening vs the old Neo4j filter, all arms: `pm.inactive_at is null`
    // excludes replaced/inactive memberships that Neo4j's
    // `[:member { active: true }]` still honors (the rel stays active; only
    // inactiveAt is set). Matches membership-scope semantics. Recorded in the
    // pre-cutover audit ledger — do not loosen to match Neo4j.
    switch (resource.name) {
      case 'Partner':
        // Member of any project connected via a partnership. Deliberate
        // tightenings vs the old Neo4j filter: soft-deleted
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
        // The partner chain extended one hop (project → partnership → partner → organization).
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
        // "Requester is an active member of ANY project" — a requester
        // property, uncorrelated with the target row. Intentionally matches
        // what the Neo4j user list did.
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

  asDrizzleCondition({ resource, session }: AsDrizzleParams<TResourceStatic>) {
    const projectIdRef = projectIdRefForResource(resource);
    // ARRAY[...]::role[] intersection — true when membership shares at least
    // one role with the required set.
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
    case 'ProgressReport':
      // Progress rows on the shared periodic_reports table are always
      // engagement-parented (never project-parented directly) — see
      // PeriodicReportRepository.parentCondition.
      return sql.raw(
        `(select "e"."project_id" from "engagements" "e" where "e"."id" = "periodic_reports"."engagement_id")`,
      );
    case 'Language':
      // A language is "member-visible" through ANY project engaging it.
      // `pm.project_id = any(array(...))` keeps the shared `= ${ref}` template
      // working with a multi-row subquery.
      return sql.raw(
        `any(array(select "e"."project_id" from "engagements" "e"
          where "e"."language_id" = "languages"."id" and "e"."deleted_at" is null))`,
      );
    // Add a case for each new project-scoped resource. The default throws so
    // a resource without one fails loud instead of emitting SQL against the
    // wrong table.
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
