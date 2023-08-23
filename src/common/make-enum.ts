import { registerEnumType } from '@nestjs/graphql';
import { cleanJoin, nonEnumerable, setHas } from '@seedcompany/common';
import { inspect, InspectOptionsStylized } from 'util';

export type EnumType<Enum> = Enum extends MadeEnum<infer Values, any>
  ? Values
  : never;

export type MadeEnum<Values extends string, Extra = unknown> = {
  readonly [Value in Values & string]: Value;
} & Readonly<Extra> &
  EnumHelpers<Values>;

interface EnumOptions<
  ValueDeclaration extends EnumValueDeclarationShape,
  Extra extends Record<string, any>,
> {
  /**
   * The name to register this enum with GraphQL.
   * If this is omitted, the enum is not exposed to GraphQL.
   */
  readonly name?: string;

  /**
   * The description of this enum for GraphQL.
   */
  readonly description?: string;

  /**
   * The values/members of the enum.
   * These can be strings or objects with extra metadata.
   */
  readonly values: readonly ValueDeclaration[];

  /**
   * Expose the order of the enum values to GraphQL.
   */
  readonly exposeOrder?: boolean;

  /**
   * Add extra (non-enumerable) properties to this enum object.
   * These will not be values of the enum, but helper things.
   *
   * This is given the built enum (without any extras),
   * in order to prevent circular references.
   */
  readonly extra?: (
    enumObject: MadeEnum<ValuesOfDeclarations<ValueDeclaration>>,
  ) => Extra;
}

/**
 * Create a better enum object that can be used in both TS & GraphQL.
 */
export const makeEnum = <
  const ValueDeclaration extends EnumValueDeclarationShape,
  const Extra extends Record<string, any> = never,
>(
  input: EnumOptions<ValueDeclaration, Extra>,
): MadeEnum<
  ValuesOfDeclarations<ValueDeclaration>,
  [Extra] extends [never] ? unknown : Extra
> => {
  const {
    name,
    description,
    values: valuesIn,
    exposeOrder,
    extra: extraFn,
  } = input;

  const entries = valuesIn.map(
    (value: EnumValueDeclarationShape): EnumValueDeclarationObjectShape =>
      typeof value === 'string' ? { value } : value,
  );

  const object = Object.fromEntries(entries.map((v) => [v.value, v.value]));

  const valueList = Object.keys(object);
  const values = new Set(valueList);
  const helpers = {
    values,
    entries,
    [Symbol.iterator]: () => values.values(),
    // @ts-expect-error Ignoring generics for implementation.
    has: (value: string) => setHas(values, value),
    [inspect.custom]: (
      depth: number,
      options: InspectOptionsStylized,
      innerInspect: typeof inspect,
    ) => {
      const label = options.stylize(
        `[Enum${name ? `: ${name}` : ''}]`,
        'special',
      );
      if (depth <= 0) {
        return label;
      }
      const members = innerInspect(valueList).slice(1, -1).replace(/'/g, '');
      return `${label} {${members}}`;
    },
  } satisfies EnumHelpers<string>;

  Object.assign(object, helpers);
  nonEnumerable(object, ...Object.keys(helpers));

  if (extraFn) {
    const extra = extraFn(object as any);
    Object.assign(object, extra);
    nonEnumerable(object, ...Object.keys(extra));
  }

  if (name) {
    const valuesMap = Object.fromEntries(
      entries.map((v, i) => [
        v.value,
        {
          deprecationReason: v.deprecationReason,
          description:
            cleanJoin('\n\n', [
              v.description,
              v.label ? `@label ${v.label}` : undefined,
              exposeOrder ? `@order ${i}` : undefined,
            ]) || undefined,
        },
      ]),
    );
    registerEnumType(object, { name, description, valuesMap });
  }

  return object as any;
};

type EnumValueDeclarationShape<Value extends string = string> =
  | Value
  | EnumValueDeclarationObjectShape<Value>;

interface EnumValueDeclarationObjectShape<Value extends string = string> {
  /**
   * The actual value.
   */
  readonly value: Value;
  /**
   * Declare a custom label for this value which is exposed in GraphQL schema.
   */
  readonly label?: string;
  /**
   * Declare a description for this value which is exposed in GraphQL schema.
   */
  readonly description?: string;
  /**
   * Declare this value as deprecated with the given reason, exposed to GraphQL schema.
   */
  readonly deprecationReason?: string;
}

type ValuesOfDeclarations<ValueDeclaration extends EnumValueDeclarationShape> =
  ValueDeclaration extends string
    ? ValueDeclaration
    : ValueDeclaration extends EnumValueDeclarationObjectShape<infer Value>
    ? Value
    : never;

interface EnumHelpers<Values extends string> {
  readonly values: ReadonlySet<Values>;
  readonly entries: ReadonlyArray<
    Readonly<EnumValueDeclarationObjectShape<Values>>
  >;
  readonly has: <In extends string>(
    value: In & {},
  ) => value is In & Values & {};
  readonly [Symbol.iterator]: () => Iterator<Values>;
}
