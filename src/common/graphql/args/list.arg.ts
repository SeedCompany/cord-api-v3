import { type PipeTransform, type Type } from '@nestjs/common';
import { Args, type ArgsOptions } from '@nestjs/graphql';
import type { AbstractClass } from 'type-fest';
import { DataObject } from '../objects/abstracts/data-object';
import { type PaginationInput } from '../objects/abstracts/pagination.input';

/**
 * A GQL argument for paginated list input
 */
export const ListArg = <T extends PaginationInput>(
  input: AbstractClass<T>,
  opts: Partial<ArgsOptions> = {},
  ...pipes: Array<Type<PipeTransform> | PipeTransform>
) =>
  Args(
    {
      name: 'input',
      type: () => input,
      nullable: true,
      defaultValue: DataObject.defaultValue(input),
      ...opts,
    },
    ...pipes,
  );
