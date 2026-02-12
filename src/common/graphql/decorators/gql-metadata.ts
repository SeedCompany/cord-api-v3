import { CLASS_TYPE_METADATA, RESOLVER_TYPE_METADATA } from '@nestjs/graphql';
import type { ClassType as ClassVal } from '@nestjs/graphql/dist/enums/class-type.enum.js';
import type { Resolver as ResolverVal } from '@nestjs/graphql/dist/enums/resolver.enum.js';
import { createMetadataDecorator } from '@seedcompany/nest';

/**
 * Metadata stored when using InterfaceType/ObjectType/InputType/ArgsType
 */
export const ClassType = createMetadataDecorator({
  key: CLASS_TYPE_METADATA,
  setter: (type: ClassVal) => type,
  types: ['class'],
});

/**
 * Metadata stored when using Query/Subscription/Mutation
 */
export const ResolverType = createMetadataDecorator({
  key: RESOLVER_TYPE_METADATA,
  setter: (type: ResolverVal) => type,
  types: ['method'],
});
