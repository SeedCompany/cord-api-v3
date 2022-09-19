import { startCase } from 'lodash';
import { inspect, InspectOptionsStylized } from 'util';
import { ResourceShape } from '~/common';
import { Policy } from '../policy.factory';
import { Condition, IsAllowedParams } from './condition.interface';

export abstract class AggregateConditions<
  TResourceStatic extends ResourceShape<any>
> implements Condition<TResourceStatic>
{
  constructor(readonly conditions: Array<Condition<TResourceStatic>>) {}

  abstract readonly iteratorKey: 'some' | 'every';

  attachPolicy(policy: Policy): Condition<TResourceStatic> {
    const newConditions = this.conditions.map(
      (condition) => condition.attachPolicy?.(policy) ?? condition
    );
    // @ts-expect-error messy to express statically, but this works as long as
    // subclass constructor doesn't change parameters.
    return new this.constructor(newConditions);
  }

  isAllowed(params: IsAllowedParams<TResourceStatic>) {
    return this.conditions[this.iteratorKey]((condition) =>
      condition.isAllowed(params)
    );
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return `${startCase(this.constructor.name)} ${inspect(this.conditions)}`;
  }
}

export class AndConditions<
  TResourceStatic extends ResourceShape<any>
> extends AggregateConditions<TResourceStatic> {
  readonly iteratorKey = 'every';
}

export class OrConditions<
  TResourceStatic extends ResourceShape<any>
> extends AggregateConditions<TResourceStatic> {
  readonly iteratorKey = 'some';
}

export const all = <T extends ResourceShape<any>>(
  ...conditions: Array<Condition<T>>
) =>
  conditions.length === 1 ? conditions[0] : new AndConditions<T>(conditions);

export const any = <T extends ResourceShape<any>>(
  ...conditions: Array<Condition<T>>
) =>
  conditions.length === 1
    ? conditions[0]
    : new OrConditions<T>(
        conditions.flatMap((c) =>
          c instanceof OrConditions ? c.conditions : c
        )
      );
