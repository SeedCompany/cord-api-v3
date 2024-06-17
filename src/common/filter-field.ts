import { applyDecorators } from '@nestjs/common';
import { Field } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Constructor, HasRequiredKeys } from 'type-fest';
import { DefaultValue } from './default-value';
import { AbstractClassType } from './types';

/**
 * A field that is a filter object probably for input on a list query.
 */
export const FilterField = <T extends object>(
  type: () => HasRequiredKeys<T> extends true ? never : AbstractClassType<T>,
  options?: {
    /**
     * There are no external fields on the filter, so don't expose to GQL.
     */
    internal?: boolean;
  },
): PropertyDecorator =>
  applyDecorators(
    ...(options?.internal
      ? []
      : [
          Field(type as unknown as () => Constructor<T>, {
            nullable: true,
            defaultValue: {} as unknown as T, // Only for GQL schema & not always applied in TS
          }),
        ]),
    Type(type),
    ValidateNested(),
    DefaultValue.Set({}), // Default when omitted
    Transform(({ value }) => value || {}), // null -> {}
  );
