import { PipeTransform, Type } from '@nestjs/common';
import { Args, ArgsOptions, ID } from '@nestjs/graphql';

export const IdArg = (
  opts: Partial<ArgsOptions> = {},
  ...pipes: Array<Type<PipeTransform> | PipeTransform>
) => Args({ name: 'id', type: () => ID, ...opts }, ...pipes);
