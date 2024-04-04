import { groupBy } from '@seedcompany/common';
import { Query } from 'cypher-query-builder';
import { get, startCase } from 'lodash';
import { Get, Paths } from 'type-fest';
import { inspect, InspectOptionsStylized } from 'util';
import { ResourceShape, UnwrapSecured } from '~/common';
import {
  Condition,
  eqlInLiteralSet,
  IsAllowedParams,
} from '../../policy/conditions';

export class EnumFieldCondition<
  TResourceStatic extends ResourceShape<any>,
  Path extends Paths<InstanceType<TResourceStatic>> & string,
> implements Condition<TResourceStatic>
{
  constructor(
    private readonly path: Path,
    private readonly allowed: ReadonlySet<ValueOfPath<TResourceStatic, Path>>,
  ) {}

  isAllowed({ object }: IsAllowedParams<TResourceStatic>) {
    // Double check at runtime that object has these, since they are usually
    // declared from DB, which cannot be verified.
    if (!object) {
      throw new Error(`Needed object's ${this.path} but object wasn't given`);
    }
    const actual = get(object, this.path) as
      | ValueOfPath<TResourceStatic, Path>
      | undefined;
    if (!actual) {
      throw new Error(`Needed object's ${this.path} but it wasn't found`);
    }

    return this.allowed.has(actual);
  }

  asCypherCondition(_query: Query) {
    return `false`; // TODO
  }

  asEdgeQLCondition() {
    return '<str>' + eqlInLiteralSet(`.${this.path}`, this.allowed);
  }

  union(conditions: this[]): Array<Condition<TResourceStatic>> {
    return groupBy(conditions, (c) => c.path).map((conditionsForField) => {
      const unioned = conditionsForField.flatMap((c) => [...c.allowed]);
      return new EnumFieldCondition(
        conditionsForField[0].path,
        new Set(unioned),
      );
    });
  }

  intersect(conditions: this[]): Array<Condition<TResourceStatic>> {
    return groupBy(conditions, (c) => c.path).map((conditionsForField) => {
      const intersected = [...conditionsForField[0].allowed].filter((v) =>
        conditionsForField.every((condition) => condition.allowed.has(v)),
      );
      return new EnumFieldCondition(
        conditionsForField[0].path,
        new Set(intersected),
      );
    });
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return `${startCase(this.path)} { ${[...this.allowed]
      .map((s) => startCase(s))
      .join(', ')} }`;
  }
}

/**
 * The following actions only apply if the object's field is one of the given allowed values.
 */
export function field<
  TResourceStatic extends ResourceShape<any>,
  Path extends Paths<InstanceType<TResourceStatic>> & string,
>(
  path: Path,
  allowed: ManyIn<ValueOfPath<TResourceStatic, Path>>,
  ...allowedMore: Array<ManyIn<ValueOfPath<TResourceStatic, Path>>>
) {
  const flattened = new Set(
    [allowed, ...allowedMore].flatMap((v) =>
      // Assume values are strings to normalize cardinality.
      typeof v === 'string'
        ? [v]
        : [...(v as Array<ValueOfPath<TResourceStatic, Path>>)],
    ),
  );
  return new EnumFieldCondition<TResourceStatic, Path>(path, flattened);
}

type ManyIn<T extends string> = T | Iterable<T>;

type ValueOfPath<
  TResourceStatic extends ResourceShape<any>,
  Path extends string,
> = UnwrapSecured<Get<InstanceType<TResourceStatic>, Path>>;
