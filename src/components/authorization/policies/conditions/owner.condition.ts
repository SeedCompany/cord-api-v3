import { Logger } from '@nestjs/common';
import { Query } from 'cypher-query-builder';
import { inspect, InspectOptionsStylized } from 'util';
import { ID, isIdLike, MaybeSecured, ResourceShape, Secured } from '~/common';
import { User } from '../../../user/dto';
import {
  AsCypherParams,
  Condition,
  IsAllowedParams,
} from '../../policy/conditions';

const CQL_VAR = 'requestingUser';

export interface HasCreator {
  creator: ID | Secured<ID>;
}

class OwnerCondition<
  TResourceStatic extends ResourceShape<HasCreator> | typeof User,
> implements Condition<TResourceStatic>
{
  isAllowed({ object, resource, session }: IsAllowedParams<TResourceStatic>) {
    if (!object) {
      throw new Error("Needed object but wasn't given");
    }

    const creator = (() => {
      if (resource.is(User)) {
        return (object as MaybeSecured<User>).id;
      }
      const o = object as MaybeSecured<HasCreator>;
      return isIdLike(o.creator) ? o.creator : o.creator.value;
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
    if (prevApplied.has('owner')) {
      return query;
    }
    prevApplied.add('owner');

    const param = query.params.addParam(other.session.userId, CQL_VAR);
    Reflect.set(other, CQL_VAR, param);

    return query;
  }

  asCypherCondition(_query: Query, other: AsCypherParams<TResourceStatic>) {
    const requester = String(Reflect.get(other, CQL_VAR));
    if (other.resource.is(User)) {
      return `node:User AND node.id = ${requester}`;
    }
    return [
      `node.creator = ${requester}`,
      `exists((node)-[:creator { active: true }]->(:Property { value: ${requester} }))`,
      `exists((node)-[:creator { active: true }]->(:User { id: ${requester} }))`,
    ].join(' OR ');
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return `Owner`;
  }
}

/**
 * The following actions only apply if the requester is the "owner" of the given object.
 */
export const owner = new OwnerCondition();
