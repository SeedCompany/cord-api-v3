import { type NonEmptyArray } from '@seedcompany/common';
import { eq } from 'drizzle-orm';
import { inspect, type InspectOptionsStylized } from 'util';
import { users } from '~/core/drizzle/schema';
import { type User } from '../../../user/dto';
import {
  type AsCypherParams,
  type AsEdgeQLParams,
  type Condition,
  fqnRelativeTo,
  type IsAllowedParams,
  MissingContextException,
} from '../../policy/conditions';

class SelfCondition<
  TResourceStatic extends typeof User,
> implements Condition<TResourceStatic> {
  isAllowed({ object, session }: IsAllowedParams<TResourceStatic>) {
    if (!object) {
      throw new MissingContextException();
    }
    return object.id === session.userId;
  }

  asCypherCondition() {
    return 'node:User AND node.id = $currentUser';
  }

  asDrizzleCondition({ session }: AsCypherParams<TResourceStatic>) {
    return eq(users.id, session.userId);
  }

  asEdgeQLCondition({ namespace }: AsEdgeQLParams<any>) {
    const currentId = fqnRelativeTo('default::currentActorId', namespace);
    return `.id ?= global ${currentId}`;
  }

  union(this: void, conditions: NonEmptyArray<this>) {
    return conditions[0];
  }

  intersect(this: void, conditions: NonEmptyArray<this>) {
    return conditions[0];
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return `Self`;
  }
}

/**
 * The following actions only apply if the requester is this user object.
 */
export const self = new SelfCondition();
