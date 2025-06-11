import { type Type } from '@nestjs/common';
import { type ModuleRef } from '@nestjs/core';
import { mapValues } from '@seedcompany/common';
import { type Simplify } from 'type-fest';

export type InstanceMapOf<T extends Record<string, Type>> = Simplify<{
  [K in keyof T]: InstanceType<T[K]>;
}>;

export const grabInstances = <T extends Record<string, Type>>(moduleRef: ModuleRef, typeMap: T) =>
  mapValues(typeMap, (_, cls) => moduleRef.get(cls)).asRecord as InstanceMapOf<T>;
