import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { InterfaceDefinitionFactory } from '@nestjs/graphql/dist/schema-builder/factories/interface-definition.factory.js';
import { UnionDefinitionFactory } from '@nestjs/graphql/dist/schema-builder/factories/union-definition.factory.js';
import type { UnionMetadata } from '@nestjs/graphql/dist/schema-builder/metadata';
import type { InterfaceMetadata } from '@nestjs/graphql/dist/schema-builder/metadata/interface.metadata';
import { ResourcesHost } from './resources.host';

/**
 * The default behavior of (Nest's) GraphQL interfaces and unions is to use
 * the "__typename" property to resolve the type
 * when no custom "resolveType" function is provided.
 *
 * This takes that one step further by running the typename string through
 * {@link ResourcesHost.enhance} to resolve the resource.
 * This lets us do aliasing like with Gel's FQN names.
 */
@Injectable()
export class DefaultTypeNameService implements OnModuleInit {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly resourcesHost: ResourcesHost,
    private readonly schemaHost: GraphQLSchemaHost,
  ) {}

  /**
   * Patch the interface & union factories to use our default implementation of
   * resolveType.
   */
  onModuleInit() {
    const interfaceFactory: any = this.moduleRef.get(
      InterfaceDefinitionFactory,
      { strict: false },
    );
    const interfaceBaseResolver =
      interfaceFactory.createResolveTypeFn.bind(interfaceFactory);
    interfaceFactory.createResolveTypeFn = (metadata: InterfaceMetadata) => {
      if (metadata.resolveType) {
        return interfaceBaseResolver(metadata);
      }
      return (instance: any) => this.defaultResolveType(instance, metadata);
    };

    const unionFactory: any = this.moduleRef.get(UnionDefinitionFactory, {
      strict: false,
    });
    const unionBaseResolver =
      unionFactory.createResolveTypeFn.bind(unionFactory);
    unionFactory.createResolveTypeFn = (metadata: UnionMetadata) => {
      if (metadata.resolveType) {
        return unionBaseResolver(metadata);
      }
      return (instance: any) => this.defaultResolveType(instance, metadata);
    };
  }

  defaultResolveType(
    instance: any,
    metadata: InterfaceMetadata | UnionMetadata,
  ): string {
    if (!Reflect.has(instance, '__typename')) {
      throw new TypenameCannotBeResolvedError(metadata.name);
    }
    const name = instance.__typename;
    if (this.schemaHost.schema.getType(name)) {
      return name;
    }
    const res = this.resourcesHost.enhance(name);
    return res.name;
  }
}

class TypenameCannotBeResolvedError extends Error {
  constructor(hostTypeName: string) {
    super(
      `Return type for "${hostTypeName}" cannot be resolved. If you did not pass a custom implementation (the "resolveType" function), you must return a "__typename" property resolving to a registered resource.`,
    );
  }
}
