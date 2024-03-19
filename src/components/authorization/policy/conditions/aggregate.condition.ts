import { groupBy, isNotNil, Nil } from '@seedcompany/common';
import { Query } from 'cypher-query-builder';
import { Class, Constructor } from 'type-fest';
import { inspect, InspectOptionsStylized } from 'util';
import { ResourceShape } from '~/common';
import { Policy } from '../policy.factory';
import {
  AsCypherParams,
  AsEdgeQLParams,
  Condition,
  IsAllowedParams,
} from './condition.interface';

export abstract class AggregateConditions<
  TResourceStatic extends ResourceShape<any> = ResourceShape<any>,
> implements Condition<TResourceStatic>
{
  protected constructor(
    readonly conditions: Array<Condition<TResourceStatic>>,
  ) {}

  attachPolicy(policy: Policy): Condition<TResourceStatic> {
    const newConditions = this.conditions.map(
      (condition) => condition.attachPolicy?.(policy) ?? condition,
    );
    // @ts-expect-error messy to express statically, but this works as long as
    // subclass constructor doesn't change parameters.
    return new this.constructor(newConditions);
  }

  isAllowed(params: IsAllowedParams<TResourceStatic>) {
    const aggFn = this instanceof AndConditions ? 'every' : 'some';
    return this.conditions[aggFn]((condition) => condition.isAllowed(params));
  }

  setupCypherContext(
    query: Query,
    prevApplied: Set<any>,
    other: AsCypherParams<TResourceStatic>,
  ) {
    for (const condition of this.conditions) {
      query =
        condition.setupCypherContext?.(query, prevApplied, other) ?? query;
    }
    return query;
  }

  asCypherCondition(
    query: Query,
    other: AsCypherParams<TResourceStatic>,
  ): string {
    if (this.conditions.length === 0) {
      return 'true';
    }
    const separator = this instanceof AndConditions ? ' AND ' : ' OR ';
    const inner = this.conditions
      .map((c) => c.asCypherCondition(query, other))
      .join(separator);
    return `(${inner})`;
  }

  asEdgeQLCondition(params: AsEdgeQLParams<TResourceStatic>): string {
    if (this.conditions.length === 0) {
      return 'true';
    }
    const separator = this instanceof AndConditions ? ' and ' : ' or ';
    const inner = this.conditions
      .map((c) => c.asEdgeQLCondition(params))
      .join(separator);
    return `(${inner})`;
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    const name = this instanceof AndConditions ? ' AND ' : ' OR ';
    const asStrings = this.conditions.map((c) => {
      const l = inspect(c);
      return c instanceof AggregateConditions ? `(${l})` : l;
    });
    return [...new Set(asStrings)].join(name);
  }
}

export class AndConditions<
  TResourceStatic extends ResourceShape<any> = ResourceShape<any>,
> extends AggregateConditions<TResourceStatic> {
  static from<T extends ResourceShape<any>>(
    ...conditionsIn: Array<Condition<T> | Nil>
  ) {
    const conditions = conditionsIn.filter(isNotNil);
    if (conditions.length === 1) {
      return conditions[0];
    }
    if (conditions.length === 0) {
      throw new Error('AndConditions requires at least one condition');
    }

    const merged = groupBy(conditions, byType).flatMap((sames) => {
      const same = sames[0]!;
      return same.intersect ? same.intersect(sames) : sames;
    });

    if (merged.length === 1) {
      return merged[0]!;
    }
    return new AndConditions<T>(merged);
  }
}

export class OrConditions<
  TResourceStatic extends ResourceShape<any> = ResourceShape<any>,
> extends AggregateConditions<TResourceStatic> {
  static from<T extends ResourceShape<any>>(
    ...conditions: Array<Condition<T> | Nil>
  ) {
    return OrConditions.fromAll(conditions);
  }

  static fromAll<T extends ResourceShape<any>>(
    conditionsIn: Array<Condition<T> | Nil>,
    { optimize = true }: { optimize?: boolean } = {},
  ) {
    const conditions = conditionsIn.filter(isNotNil);
    if (conditions.length === 1) {
      return conditions[0];
    }
    if (conditions.length === 0) {
      throw new Error('OrConditions requires at least one condition');
    }

    const flattened = conditions.flatMap((c) =>
      c instanceof OrConditions ? c.conditions : c,
    );

    if (!optimize) {
      return new OrConditions(flattened);
    }

    const merged = groupBy(flattened, byType).flatMap((sames) => {
      const same = sames[0]!;
      return same.union ? same.union(sames) : sames;
    });

    if (merged.length === 1) {
      return merged[0]!;
    }
    return new OrConditions<T>(merged);
  }
}

export const all = AndConditions.from;
export const any = OrConditions.from;

const byType = <T extends Class<any>>(item: InstanceType<T>) =>
  item.constructor as Constructor<T>;
