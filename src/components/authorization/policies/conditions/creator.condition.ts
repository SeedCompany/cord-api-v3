import { Logger } from '@nestjs/common';
import { inspect, type InspectOptionsStylized } from 'util';
import {
  type ID,
  isIdLike,
  type MaybeSecured,
  type MaybeSecuredProp,
  type ResourceShape,
  unwrapSecured,
} from '~/common';
import { type LinkTo } from '~/core/resources';
import {
  type Condition,
  type IsAllowedParams,
  MissingContextException,
} from '../../policy/conditions';

export interface HasCreator {
  creator: MaybeSecuredProp<ID | LinkTo<'User'>>;
}

class CreatorCondition<TResourceStatic extends ResourceShape<HasCreator>>
  implements Condition<TResourceStatic>
{
  isAllowed({ object, session }: IsAllowedParams<TResourceStatic>) {
    if (!object) {
      throw new MissingContextException();
    }

    const creator = (() => {
      const o = object as MaybeSecured<HasCreator>;
      const creator = unwrapSecured(o.creator);
      if (!creator) {
        return undefined;
      }
      return isIdLike(creator) ? creator : creator.id;
    })();
    if (!creator) {
      Logger.warn(
        'Could not find or view creator ID to determine if owner',
        'privileges:condition:owner',
      );
    }

    return creator === session.userId;
  }

  asCypherCondition() {
    const requester = '$currentUser';
    return [
      `node.creator = ${requester}`,
      `exists((node)-[:creator { active: true }]->(:Property { value: ${requester} }))`,
      `exists((node)-[:creator { active: true }]->(:User { id: ${requester} }))`,
    ].join(' OR ');
  }

  asEdgeQLCondition() {
    return '.isCreator';
  }

  union(this: void, conditions: this[]) {
    return conditions[0];
  }

  intersect(this: void, conditions: this[]) {
    return conditions[0];
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return `Creator`;
  }
}

/**
 * The following actions only apply if the requester is the "creator" of the given object.
 */
export const creator = new CreatorCondition();
