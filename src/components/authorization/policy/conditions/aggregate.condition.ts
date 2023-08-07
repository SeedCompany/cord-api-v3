import { Query } from 'cypher-query-builder';
import { Class, Constructor } from 'type-fest';
import { inspect, InspectOptionsStylized } from 'util';
import { ResourceShape } from '~/common';
import { Policy } from '../policy.factory';
import {
  AsCypherParams,
  Condition,
  IsAllowedParams,
} from './condition.interface';

export abstract class AggregateConditions<
  TResourceStatic extends ResourceShape<any>,
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

  protected abstract readonly iteratorKey: 'some' | 'every';
  isAllowed(params: IsAllowedParams<TResourceStatic>) {
    return this.conditions[this.iteratorKey]((condition) =>
      condition.isAllowed(params),
    );
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

  protected abstract readonly cypherJoiner: string;
  asCypherCondition(
    query: Query,
    other: AsCypherParams<TResourceStatic>,
  ): string {
    if (this.conditions.length === 0) {
      return 'true';
    }
    const inner = this.conditions
      .map((c) => c.asCypherCondition(query, other))
      .join(this.cypherJoiner);
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
  TResourceStatic extends ResourceShape<any>,
> extends AggregateConditions<TResourceStatic> {
  protected readonly iteratorKey = 'every';
  protected readonly cypherJoiner = ' AND ';

  static from<T extends ResourceShape<any>>(
    ...conditions: Array<Condition<T>>
  ) {
    if (conditions.length === 1) {
      return conditions[0];
    }

    const merged = [...groupBy(conditions, byType).values()].flatMap(
      (sames) => {
        const same = sames[0]!;
        return same.intersect ? same.intersect(sames) : sames;
      },
    );

    if (merged.length === 1) {
      return merged[0]!;
    }
    return new AndConditions<T>(merged);
  }
}

export class OrConditions<
  TResourceStatic extends ResourceShape<any>,
> extends AggregateConditions<TResourceStatic> {
  protected readonly iteratorKey = 'some';
  protected readonly cypherJoiner = ' OR ';

  static from<T extends ResourceShape<any>>(
    ...conditions: Array<Condition<T>>
  ) {
    if (conditions.length === 1) {
      return conditions[0];
    }

    const flattened = conditions.flatMap((c) =>
      c instanceof OrConditions ? c.conditions : c,
    );

    const merged = [...groupBy(flattened, byType).values()].flatMap((sames) => {
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

const groupBy = <K, V>(items: readonly V[], by: (item: V) => K) =>
  items.reduce((map, item) => {
    const groupKey = by(item);
    const prev = map.get(groupKey) ?? [];
    map.set(groupKey, [...prev, item]);
    return map;
  }, new Map<K, V[]>());

const byType = <T extends Class<any>>(item: InstanceType<T>) =>
  item.constructor as Constructor<T>;
