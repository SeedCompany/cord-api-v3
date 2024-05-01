import { Logger } from '@nestjs/common';
import { Query } from 'cypher-query-builder';
import { inspect, InspectOptionsStylized } from 'util';
import {
  ID,
  isIdLike,
  MaybeSecured,
  MaybeSecuredProp,
  ResourceShape,
  unwrapSecured,
} from '~/common';
import { type LinkTo } from '~/core/resources';
import {
  AsCypherParams,
  Condition,
  IsAllowedParams,
} from '../../policy/conditions';

const CQL_VAR = 'requestingUser';

export interface HasCreator {
  creator: MaybeSecuredProp<ID | LinkTo<'User'>>;
}

class CreatorCondition<TResourceStatic extends ResourceShape<HasCreator>>
  implements Condition<TResourceStatic>
{
  isAllowed({ object, session }: IsAllowedParams<TResourceStatic>) {
    if (!object) {
      throw new Error("Needed object but wasn't given");
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

  setupCypherContext(
    query: Query,
    prevApplied: Set<any>,
    other: AsCypherParams<TResourceStatic>,
  ) {
    if (prevApplied.has('creator')) {
      return query;
    }
    prevApplied.add('creator');

    const param = query.params.addParam(other.session.userId, CQL_VAR);
    Reflect.set(other, CQL_VAR, param);

    return query;
  }

  asCypherCondition(_query: Query, other: AsCypherParams<TResourceStatic>) {
    const requester = String(Reflect.get(other, CQL_VAR));
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
