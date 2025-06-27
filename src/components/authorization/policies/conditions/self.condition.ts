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

class SelfCondition<TResourceStatic extends typeof User>
  implements Condition<TResourceStatic>
{
  isAllowed({ object, session }: IsAllowedParams<TResourceStatic>) {
    if (!object) {
      throw new MissingContextException();
    }
    return object.id === session.userId;
  }

  asCypherCondition() {
    return 'node:User AND node.id = $currentUser';
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
