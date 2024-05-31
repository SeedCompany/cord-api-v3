import { registerEnumType } from '@nestjs/graphql';
import { cleanJoin, mapKeys, nonEnumerable } from '@seedcompany/common';
import { lowerCase } from 'lodash';
import { titleCase } from 'title-case';
import { inspect, InspectOptionsStylized } from 'util';

export type EnumType<Enum> = Enum extends MadeEnum<infer Values, any, any>
  ? Values
  : never;

export type MadeEnum<
  Values extends string,
  ValueDeclaration = EnumValueDeclarationShape,
  Extra = unknown,
> = {
  readonly [Value in Values & string]: Value;
} & EnumHelpers<
  Values,
  ValueDeclaration & ImplicitValueDeclarationShape<Values>
> &
  Readonly<Extra>;

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
    // MadeEnum without Extras & ImplicitValueDeclarationShape
    enumObject: {
      readonly [Value in ValuesOfDeclarations<ValueDeclaration> &
        string]: Value;
    } & EnumHelpers<
      ValuesOfDeclarations<ValueDeclaration>,
      NormalizedValueDeclaration<ValueDeclaration>
    >,
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
  NormalizedValueDeclaration<ValueDeclaration>,
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
  const entryMap = mapKeys.fromList(entries, (e) => e.value).asMap;

  const object = Object.fromEntries(entries.map((v) => [v.value, v.value]));

  const valueList = Object.keys(object);
  const values = new Set(valueList);
  const helpers = {
    values,
    entries,
    [Symbol.iterator]: () => values.values(),
    // @ts-expect-error Ignoring generics for implementation.
    has: (value: string) => entryMap.has(value),
    entry: (value: string) => {
      const entry = entryMap.get(value);
      if (!entry) {
        throw new Error(`${name ?? 'Enum'} does not have member: "${value}"`);
      }
      return entry;
    },
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
  } satisfies EnumHelpers<string, any>;

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

  for (const entry of entries) {
    // @ts-expect-error ignoring immutable here.
    entry.label ??= titleCase(lowerCase(entry.value)).replace(/ and /g, ' & ');
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

type ImplicitValueDeclarationShape<Value extends string> = Required<
  Pick<EnumValueDeclarationObjectShape<Value>, 'value' | 'label'>
>;

type ValuesOfDeclarations<ValueDeclaration extends EnumValueDeclarationShape> =
  ValueDeclaration extends string
    ? ValueDeclaration
    : ValueDeclaration extends EnumValueDeclarationObjectShape<infer Value>
    ? Value
    : never;

/**
 * This unifies all values to have the standard object shape, plus the extra
 * properties as optional.
 */
type NormalizedValueDeclaration<Declaration extends EnumValueDeclarationShape> =
  // For values that are objects, accept them as they are...
  | (Extract<Declaration, EnumValueDeclarationObjectShape> &
      // plus all the normal object keys
      EnumValueDeclarationObjectShape<ValuesOfDeclarations<Declaration>>)
  // For values that are strings, convert them to the standard shape...
  | (EnumValueDeclarationObjectShape<Extract<Declaration, string>> &
      // and include all the extra keys as optional
      Partial<
        Omit<
          Extract<Declaration, EnumValueDeclarationObjectShape>,
          keyof EnumValueDeclarationObjectShape
        >
      >);

interface EnumHelpers<Values extends string, ValueDeclaration> {
  readonly values: ReadonlySet<Values>;
  readonly entries: ReadonlyArray<Readonly<ValueDeclaration>>;
  readonly entry: (value: Values) => Readonly<ValueDeclaration>;
  readonly has: <In extends string>(
    value: In & {},
  ) => value is In & Values & {};
  readonly [Symbol.iterator]: () => Iterator<Values>;
}
