import { type NonEmptyArray } from '@seedcompany/common';
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

  // migration-todo: add asDrizzleCondition when User is ported to Postgres —
  // subquery on internship_engagements where intern_id = users.id.

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
