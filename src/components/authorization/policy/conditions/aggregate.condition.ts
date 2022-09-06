import { ResourceShape } from '~/common';
import { Condition, IsAllowedParams } from './condition.interface';

export class AndConditions<TResourceStatic extends ResourceShape<any>>
  implements Condition<TResourceStatic>
{
  constructor(readonly conditions: Array<Condition<TResourceStatic>>) {}

  isAllowed(params: IsAllowedParams<TResourceStatic>) {
    return this.conditions.every((condition) => condition.isAllowed(params));
  }
}

export class OrConditions<TResourceStatic extends ResourceShape<any>>
  implements Condition<TResourceStatic>
{
  constructor(readonly conditions: Array<Condition<TResourceStatic>>) {}

  isAllowed(params: IsAllowedParams<TResourceStatic>) {
    return this.conditions.some((condition) => condition.isAllowed(params));
  }
}
