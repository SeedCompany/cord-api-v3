import { Query } from 'cypher-query-builder';
import { inspect, InspectOptionsStylized } from 'util';
import { ResourceShape } from '~/common';
import { User } from '../../../user/dto';
import { Condition, IsAllowedParams } from '../../policy/conditions';

class OwnerCondition<TResourceStatic extends ResourceShape<any> & typeof User>
  implements Condition<TResourceStatic>
{
  isAllowed({ object, resource, session }: IsAllowedParams<TResourceStatic>) {
    if (!object) {
      throw new Error("Needed object but wasn't given");
    }

    return resource.is(User) && object.id === session.userId;
  }

  asCypherCondition(_query: Query) {
    return `false`; // stubbed
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return `Owner`;
  }
}

/**
 * The following actions only apply if the requester is the "owner" of the given object.
 */
export const owner = new OwnerCondition();
