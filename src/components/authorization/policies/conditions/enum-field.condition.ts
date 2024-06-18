import { groupBy } from '@seedcompany/common';
import { Query } from 'cypher-query-builder';
import { get, startCase } from 'lodash';
import { Get, Paths } from 'type-fest';
import { inspect, InspectOptionsStylized } from 'util';
import { ResourceShape, unwrapSecured, UnwrapSecured } from '~/common';
import {
  Condition,
  eqlInLiteralSet,
  IsAllowedParams,
  MissingContextException,
} from '../../policy/conditions';

export class EnumFieldCondition<
  TResourceStatic extends ResourceShape<any>,
  Path extends Paths<InstanceType<TResourceStatic>> & string,
> implements Condition<TResourceStatic>
{
  constructor(
    private readonly path: Path,
    private readonly allowed: ReadonlySet<ValueOfPath<TResourceStatic, Path>>,
    private readonly customId?: string,
  ) {}

  isAllowed({ object }: IsAllowedParams<TResourceStatic>) {
    // Double check at runtime that object has these, since they are usually
    // declared from DB, which cannot be verified.
    if (!object) {
      throw new MissingContextException(
        `Needed object's ${this.path} but object wasn't given`,
      );
    }
    const value = get(object, this.path) as
      | Get<InstanceType<TResourceStatic>, Path>
      | undefined;
    const actual = unwrapSecured(value);
    if (!actual) {
      throw new MissingContextException(
        `Needed object's ${this.path} but it wasn't found`,
      );
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
        conditions.length === 1 ? conditions[0].customId : undefined,
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
        conditions.length === 1 ? conditions[0].customId : undefined,
      );
    });
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    if (this.customId) {
      return this.customId;
    }
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
  customId?: string,
) {
  const flattened = new Set(
    // Assume values are strings to normalize cardinality.
    typeof allowed === 'string'
      ? [allowed]
      : [...(allowed as Array<ValueOfPath<TResourceStatic, Path>>)],
  );
  return new EnumFieldCondition<TResourceStatic, Path>(
    path,
    flattened,
    customId,
  );
}

type ManyIn<T extends string> = T | Iterable<T>;

type ValueOfPath<
  TResourceStatic extends ResourceShape<any>,
  Path extends string,
> = UnwrapSecured<Get<InstanceType<TResourceStatic>, Path>>;
