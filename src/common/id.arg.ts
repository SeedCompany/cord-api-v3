import { PipeTransform, Type } from '@nestjs/common';
import { Args, ArgsOptions, ID as IdType } from '@nestjs/graphql';
import { ValidateIdPipe } from './validators';

export const IdArg = (
  opts: Partial<ArgsOptions> = {},
  ...pipes: Array<Type<PipeTransform> | PipeTransform>
) =>
  Args({ name: 'id', type: () => IdType, ...opts }, ValidateIdPipe, ...pipes);
