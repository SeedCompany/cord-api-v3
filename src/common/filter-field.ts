import { applyDecorators } from '@nestjs/common';
import { Field } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { HasRequiredKeys } from 'type-fest';
import { AbstractClassType } from './types';

/**
 * A field that is a filter object probably for input on a list query.
 */
export const FilterField = <T extends object>(
  type: HasRequiredKeys<T> extends true ? never : AbstractClassType<T>,
  options?: {
    /**
     * There are no external fields on the filter, so don't expose to GQL.
     */
    internal?: boolean;
  }
): PropertyDecorator =>
  applyDecorators(
    ...(options?.internal
      ? []
      : [
          Field(() => type, {
            nullable: true,
            defaultValue: {},
          }),
        ]),
    Type(() => type),
    ValidateNested()
  );
