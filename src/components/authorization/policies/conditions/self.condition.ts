import { Query } from 'cypher-query-builder';
import { inspect, InspectOptionsStylized } from 'util';
import { User } from '../../../user/dto';
import {
  AsCypherParams,
  AsEdgeQLParams,
  Condition,
  fqnRelativeTo,
  IsAllowedParams,
} from '../../policy/conditions';

const CQL_VAR = 'requestingUser';

class SelfCondition<TResourceStatic extends typeof User>
  implements Condition<TResourceStatic>
{
  isAllowed({ object, session }: IsAllowedParams<TResourceStatic>) {
    if (!object) {
      throw new Error("Needed user object but wasn't given");
    }
    return object.id === session.userId;
  }

  setupCypherContext(
    query: Query,
    prevApplied: Set<any>,
    other: AsCypherParams<TResourceStatic>,
  ) {
    if (prevApplied.has('self')) {
      return query;
    }
    prevApplied.add('self');

    const param = query.params.addParam(other.session.userId, CQL_VAR);
    Reflect.set(other, CQL_VAR, param);

    return query;
  }

  asCypherCondition(_query: Query, other: AsCypherParams<TResourceStatic>) {
    const requester = String(Reflect.get(other, CQL_VAR));
    return `node:User AND node.id = ${requester}`;
  }

  asEdgeQLCondition({ namespace }: AsEdgeQLParams<any>) {
    const currentId = fqnRelativeTo('default::currentActorId', namespace);
    return `.id ?= global ${currentId}`;
  }

  union(this: void, conditions: this[]) {
    return conditions[0];
  }

  intersect(this: void, conditions: this[]) {
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
