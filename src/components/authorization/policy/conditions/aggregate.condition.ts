import { startCase } from 'lodash';
import { inspect, InspectOptionsStylized } from 'util';
import { ResourceShape } from '~/common';
import { Condition, IsAllowedParams } from './condition.interface';

abstract class AggregateConditions<TResourceStatic extends ResourceShape<any>>
  implements Condition<TResourceStatic>
{
  constructor(readonly conditions: Array<Condition<TResourceStatic>>) {}

  abstract readonly iteratorKey: 'some' | 'every';

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
