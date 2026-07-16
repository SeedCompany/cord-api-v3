import { type NonEmptyArray } from '@seedcompany/common';
import { sql } from 'drizzle-orm';
import { inspect, type InspectOptionsStylized } from 'util';
import { type User } from '../../../user/dto';
import {
  type AsEdgeQLParams,
  type Condition,
  fqnRelativeTo,
  type IsAllowedParams,
  MissingContextException,
} from '../../policy/conditions';

class IsInternCondition<
  TResourceStatic extends typeof User,
> implements Condition<TResourceStatic> {
  isAllowed({ object }: IsAllowedParams<TResourceStatic>) {
    if (!object) {
      throw new MissingContextException();
    }
    return Boolean(Reflect.get(object, 'isIntern'));
  }

  asCypherCondition() {
    return 'exists((node)<-[:intern { active: true }]-(:InternshipEngagement))';
  }

  asEdgeQLCondition({ namespace }: AsEdgeQLParams<TResourceStatic>) {
    const InternshipEngagement = fqnRelativeTo(
      'default::InternshipEngagement',
      namespace,
    );
    return `exists .<intern[is ${InternshipEngagement}]`;
  }

  asDrizzleCondition() {
    // Mirrors the cypher: the user row is the intern on ≥1 InternshipEngagement.
    // Engagement liveness (`deleted_at`) replaces Neo4j's Deleted_ label
    // rewrite. No project-liveness join on purpose — Neo4j doesn't sever an
    // engagement's `intern` edge when its project is deleted, and the hydrate
    // side (user.drizzle.repository.ts `internUserIds`) must stay in lockstep
    // with this predicate.
    return sql`exists (
      select 1 from "engagements" "e"
      where "e"."intern_id" = "users"."id"
        and "e"."type" = 'Internship'
        and "e"."deleted_at" is null
    )`;
  }

  union(this: void, conditions: NonEmptyArray<this>) {
    return conditions[0];
  }

  intersect(this: void, conditions: NonEmptyArray<this>) {
    return conditions[0];
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return 'IsIntern';
  }
}

/**
 * The following actions only apply if this User is the `intern` on at least one
 * InternshipEngagement — i.e. a participant in the GTL (Global Translation
 * Leader) program.
 *
 * Backed by the `isIntern` property on `User`, which the repository hydrate
 * computes alongside other derived fields.
 */
export const isIntern = new IsInternCondition();
