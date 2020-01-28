import { PipeTransform, Type } from '@nestjs/common';
import { Args, ArgsOptions } from '@nestjs/graphql';
import { ID } from 'type-graphql';

export const IdArg = (
  opts: Partial<ArgsOptions> = {},
  ...pipes: Array<Type<PipeTransform> | PipeTransform>
) => Args({ name: 'id', type: () => ID, ...opts }, ...pipes);
