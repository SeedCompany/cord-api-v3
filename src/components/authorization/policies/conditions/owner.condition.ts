import { Query } from 'cypher-query-builder';
import { inspect, InspectOptionsStylized } from 'util';
import { ResourceShape } from '~/common';
import { User } from '../../../user/dto';
import {
  AsCypherParams,
  Condition,
  IsAllowedParams,
} from '../../policy/conditions';

const CQL_VAR = 'requestingUser';

class OwnerCondition<TResourceStatic extends ResourceShape<any> & typeof User>
  implements Condition<TResourceStatic>
{
  isAllowed({ object, resource, session }: IsAllowedParams<TResourceStatic>) {
    if (!object) {
      throw new Error("Needed object but wasn't given");
    }

    return resource.is(User) && object.id === session.userId;
  }

  setupCypherContext(
    query: Query,
    prevApplied: Set<any>,
    other: AsCypherParams<TResourceStatic>
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
    return `node:User AND node.id = ${String(Reflect.get(other, CQL_VAR))}`;
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return `Owner`;
  }
}

/**
 * The following actions only apply if the requester is the "owner" of the given object.
 */
export const owner = new OwnerCondition();
