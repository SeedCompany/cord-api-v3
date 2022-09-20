import { Query } from 'cypher-query-builder';
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

  attachPolicy(policy: Policy): Condition<TResourceStatic> {
    const newConditions = this.conditions.map(
      (condition) => condition.attachPolicy?.(policy) ?? condition
    );
    // @ts-expect-error messy to express statically, but this works as long as
    // subclass constructor doesn't change parameters.
    return new this.constructor(newConditions);
  }

  protected abstract readonly iteratorKey: 'some' | 'every';
  isAllowed(params: IsAllowedParams<TResourceStatic>) {
    return this.conditions[this.iteratorKey]((condition) =>
      condition.isAllowed(params)
    );
  }

  setupCypherContext(query: Query, prevApplied: Set<any>) {
    for (const condition of this.conditions) {
      query = condition.setupCypherContext?.(query, prevApplied) ?? query;
    }
    return query;
  }

  protected abstract readonly cypherJoiner: string;
  asCypherCondition(query: Query): string {
    if (this.conditions.length === 0) {
      return 'true';
    }
    const inner = this.conditions
      .map((c) => c.asCypherCondition(query))
      .join(this.cypherJoiner);
    return `(${inner})`;
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return `${startCase(this.constructor.name)} ${inspect(this.conditions)}`;
  }
}

export class AndConditions<
  TResourceStatic extends ResourceShape<any>
> extends AggregateConditions<TResourceStatic> {
  protected readonly iteratorKey = 'every';
  protected readonly cypherJoiner = ' AND ';
}

export class OrConditions<
  TResourceStatic extends ResourceShape<any>
> extends AggregateConditions<TResourceStatic> {
  protected readonly iteratorKey = 'some';
  protected readonly cypherJoiner = ' OR ';
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
