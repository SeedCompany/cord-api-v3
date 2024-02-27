import { groupBy } from '@seedcompany/common';
import { Query } from 'cypher-query-builder';
import { startCase } from 'lodash';
import { ConditionalKeys } from 'type-fest';
import { inspect, InspectOptionsStylized } from 'util';
import { ResourceShape, Secured } from '~/common';
import { Condition, IsAllowedParams } from '../../policy/conditions';

export class EnumFieldCondition<
  TResourceStatic extends ResourceShape<any>,
  Field extends string,
> implements Condition<TResourceStatic>
{
  constructor(
    private readonly field: Field,
    private readonly allowed: ReadonlySet<FieldOf<TResourceStatic, Field>>,
  ) {}

  isAllowed({ object }: IsAllowedParams<TResourceStatic>) {
    // Double check at runtime that object has these, since they are usually
    // declared from DB, which cannot be verified.
    if (!object) {
      throw new Error(`Needed object's ${this.field} but object wasn't given`);
    }
    const actual = Reflect.get(object, this.field) as
      | FieldOf<TResourceStatic, Field>
      | undefined;
    if (!actual) {
      throw new Error(`Needed object's ${this.field} but status wasn't found`);
    }

    return this.allowed.has(actual);
  }

  asCypherCondition(_query: Query) {
    return `false`; // TODO
  }

  union(conditions: this[]): Array<Condition<TResourceStatic>> {
    return groupBy(conditions, (c) => c.field).map((conditionsForField) => {
      const unioned = conditionsForField.flatMap((c) => [...c.allowed]);
      return new EnumFieldCondition(
        conditionsForField[0].field,
        new Set(unioned),
      );
    });
  }

  intersect(conditions: this[]): Array<Condition<TResourceStatic>> {
    return groupBy(conditions, (c) => c.field).map((conditionsForField) => {
      const intersected = [...conditionsForField[0].allowed].filter((v) =>
        conditionsForField.every((condition) => condition.allowed.has(v)),
      );
      return new EnumFieldCondition(
        conditionsForField[0].field,
        new Set(intersected),
      );
    });
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return `${startCase(this.field)} { ${[...this.allowed]
      .map((s) => startCase(s))
      .join(', ')} }`;
  }
}

/**
 * The following actions only apply if the object's field is one of the given allowed values.
 */
export function field<
  TResourceStatic extends ResourceShape<any>,
  Field extends ConditionalKeys<
    InstanceType<TResourceStatic>,
    string | Secured<string>
  > &
    string,
>(
  field: Field,
  allowed: ManyIn<FieldOf<TResourceStatic, Field>>,
  ...allowedMore: Array<ManyIn<FieldOf<TResourceStatic, Field>>>
) {
  const flattened = new Set(
    [allowed, ...allowedMore].flatMap((v) =>
      typeof v === 'string' ? [v] : [...v],
    ),
  );
  return new EnumFieldCondition<TResourceStatic, Field>(field, flattened);
}

type ManyIn<T extends string> = T | Iterable<T>;

type FieldOf<
  TResourceStatic extends ResourceShape<any>,
  Field extends string,
> = InstanceType<TResourceStatic> extends HasField<Field, infer Value>
  ? `${Value}`
  : never;

type HasField<Field extends string, EnumValue extends string> = {
  readonly [_ in Field]: EnumValue | Secured<EnumValue>;
};
