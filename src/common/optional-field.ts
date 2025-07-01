import { applyDecorators } from '@nestjs/common';
import { Field, type FieldOptions } from '@nestjs/graphql';
import { type NullableList } from '@nestjs/graphql/dist/interfaces/base-type-options.interface';
import { Transform } from 'class-transformer';

export type OptionalFieldOptions = FieldOptions & {
  /**
   * If true, values can be omitted/undefined or null.
   * This will override `optional` if truthy.
   */
  nullable?: boolean | NullableList;
  /**
   * If true, values can be omitted/undefined but not null.
   */
  optional?: boolean;
  transform?: TransformerLink;
};

type TransformerLink = (prev: Transformer) => Transformer;
type Transformer<I = any, O = any> = (value: I) => O;
export const withDefaultTransform =
  (
    input: TransformerLink | undefined,
    wrapping: TransformerLink,
  ): TransformerLink =>
  (base) =>
    input?.(wrapping(base)) ?? wrapping(base);

/**
 * A field that is optional/omissible/can be undefined.
 * Whether it can be explicitly null is based on `nullable`.
 */
export function OptionalField(
  typeFn: () => any,
  options?: OptionalFieldOptions,
): PropertyDecorator;
export function OptionalField(
  options?: OptionalFieldOptions,
): PropertyDecorator;
export function OptionalField(...args: any) {
  const typeFn: (() => any) | undefined =
    typeof args[0] === 'function' ? (args[0] as () => any) : undefined;
  const options: OptionalFieldOptions =
    (typeof args[0] === 'function' ? args[1] : args[0]) ?? {};
  const nilIn = options.nullable ?? options.optional ?? true;
  const nullOut = !!options.nullable;
  const schemaOptions = {
    ...options,
    nullable: nilIn,
  };
  const defaultTransformer: Transformer = (value) => {
    if (value === null && !nullOut) {
      return undefined;
    }
    return value;
  };
  const finalTransformer =
    options.transform?.(defaultTransformer) ?? defaultTransformer;
  return applyDecorators(
    typeFn ? Field(typeFn, schemaOptions) : Field(schemaOptions),
    Transform(({ value }) => finalTransformer(value)),
  );
}
