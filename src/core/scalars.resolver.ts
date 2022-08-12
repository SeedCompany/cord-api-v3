import { Provider, Type } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import {
  SCALAR_NAME_METADATA,
  SCALAR_TYPE_METADATA,
} from '@nestjs/graphql/dist/graphql.constants';
import { GraphQLScalarType } from 'graphql';
import { getRegisteredScalars } from '../common/scalars';

/**
 * Ensure every scalar has a use in schema to prevent compilation errors.
 * These are declared dynamically below.
 */
@Resolver()
class ScalarResolver {}

for (const scalar of getRegisteredScalars()) {
  const name =
    scalar instanceof GraphQLScalarType
      ? scalar.name
      : (Reflect.getMetadata(SCALAR_NAME_METADATA, scalar) as string);
  const typeFn =
    scalar instanceof GraphQLScalarType
      ? () => scalar
      : Reflect.getMetadata(SCALAR_TYPE_METADATA, scalar);

  const key = `unstable_stub${name}`;
  const cls = ScalarResolver.prototype as any;
  cls[key] = () => null;
  Query(typeFn, {
    deprecationReason: 'Only here to prevent schema errors, do not use',
    nullable: true,
  })(cls, key, Object.getOwnPropertyDescriptor(cls, key)!);
}

export const ScalarProviders: Provider[] = [
  ScalarResolver,
  ...getRegisteredScalars().filter(
    (scalar): scalar is Type => !(scalar instanceof GraphQLScalarType)
  ),
];
