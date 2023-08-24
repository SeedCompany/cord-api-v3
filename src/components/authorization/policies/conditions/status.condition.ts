import { Query } from 'cypher-query-builder';
import { startCase } from 'lodash';
import { inspect, InspectOptionsStylized } from 'util';
import { Many, ResourceShape, Secured } from '~/common';
import { Condition, IsAllowedParams } from '../../policy/conditions';

export class StatusCondition<TResourceStatic extends ResourceShape<any>>
  implements Condition<TResourceStatic>
{
  constructor(
    private readonly allowedStatus: ReadonlySet<StatusOf<TResourceStatic>>,
  ) {}

  isAllowed({ object }: IsAllowedParams<TResourceStatic>) {
    // Double check at runtime that object has these, since they are usually
    // declared from DB which cannot be verified.
    if (!object) {
      throw new Error("Needed object's status but object wasn't given");
    }
    const actual = Reflect.get(object, 'status') as
      | StatusOf<TResourceStatic>
      | undefined;
    if (!actual) {
      throw new Error("Needed object's status but status wasn't found");
    }

    return this.allowedStatus.has(actual);
  }

  asCypherCondition(_query: Query) {
    return `false`; // TODO
  }

  union(conditions: this[]) {
    const statuses = conditions.flatMap((cond) => [...cond.allowedStatus]);
    return new StatusCondition(new Set(statuses));
  }

  intersect(conditions: this[]) {
    const statuses = [...conditions[0].allowedStatus].filter((v) =>
      conditions.every((cond) => cond.allowedStatus.has(v)),
    );
    return new StatusCondition(new Set(statuses));
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return `Status { ${[...this.allowedStatus]
      .map((s) => startCase(s))
      .join(', ')} }`;
  }
}

/**
 * The following actions only apply if the object's status is one of the given.
 */
export const status = <TResourceStatic extends ResourceShape<any>>(
  ...status: Array<Many<StatusOf<TResourceStatic>>>
) =>
  new StatusCondition<TResourceStatic>(
    new Set(status.flat() as Array<StatusOf<TResourceStatic>>),
  );

type StatusOf<TResourceStatic extends ResourceShape<any>> =
  InstanceType<TResourceStatic> extends HasStatus<infer Status>
    ? `${Status}`
    : never;

interface HasStatus<Status extends string> {
  status: Status | Secured<Status>;
}
