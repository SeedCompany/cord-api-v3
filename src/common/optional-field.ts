import { applyDecorators } from '@nestjs/common';
import { Field, FieldOptions } from '@nestjs/graphql';
import { NullableList } from '@nestjs/graphql/dist/interfaces/base-type-options.interface';
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
  transform?: (value: any) => unknown;
};

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
  const options: OptionalFieldOptions | undefined =
    typeof args[0] === 'function' ? args[1] : args[0];
  const opts = {
    ...options,
    nullable: options?.nullable ?? options?.optional ?? true,
  };
  return applyDecorators(
    typeFn ? Field(typeFn, opts) : Field(opts),
    Transform(({ value }) => {
      if (!options?.nullable && (options?.optional ?? true) && value == null) {
        return undefined;
      }
      return options?.transform ? options.transform(value) : value;
    }),
  );
}
