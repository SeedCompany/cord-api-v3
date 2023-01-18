import { Injectable } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { isObjectType } from 'graphql';
import { mapValues } from 'lodash';
import { ValueOf } from 'ts-essentials';
import { LiteralUnion } from 'type-fest';
import { CachedForArg, EnhancedResource, ServerException } from '~/common';
import type { LegacyResourceMap } from '../../components/authorization/model/resource-map';
import { ResourceMap } from './map';
import { __privateDontUseThis } from './resource-map-holder';

export type EnhancedResourceMap = {
  [K in keyof ResourceMap]: EnhancedResource<ResourceMap[K]>;
};

@Injectable()
export class ResourcesHost {
  constructor(private readonly gqlSchema: GraphQLSchemaHost) {}

  async getMap() {
    // Deferred import until now to prevent circular dependency
    const legacyPath = await import(
      '../../components/authorization/model/resource-map'
    );

    // @ts-expect-error Yeah we are assuming each type has been correctly
    // registered & type declared.
    const map: ResourceMap = {
      ...__privateDontUseThis,
      ...(legacyPath.LegacyResourceMap as object),
    };
    return map;
  }

  async getEnhancedMap(): Promise<EnhancedResourceMap> {
    const map = await this.getMap();
    return mapValues(map, EnhancedResource.of) as any;
  }

  async getByName<K extends keyof ResourceMap>(
    name: K
  ): Promise<EnhancedResource<ValueOf<Pick<ResourceMap, K>>>>;
  async getByName(
    name: LiteralUnion<keyof ResourceMap, string>
  ): Promise<EnhancedResource<ValueOf<ResourceMap>>>;
  async getByName(name: keyof ResourceMap): Promise<EnhancedResource<any>> {
    const map = await this.getEnhancedMap();
    const resource = map[name];
    if (!resource) {
      throw new ServerException(
        `Unable to determine resource from ResourceMap for type: ${name}`
      );
    }
    return resource;
  }

  async getInterfaces(
    resource: EnhancedResource<any>
  ): Promise<ReadonlyArray<EnhancedResource<any>>> {
    // Use interfaces from GQL schema if it's available.
    // Otherwise, fallback to the interfaces from DTO class hierarchy.
    // The former doesn't work with CLI.
    // The latter doesn't work for IntersectionTypes.
    // Hoping to resolve with https://github.com/nestjs/graphql/pull/2435
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      this.gqlSchema.schema;
    } catch (e) {
      return await this.getInterfacesFromClassType(resource);
    }
    return await this.getInterfacesFromGQLSchema(resource);
  }

  @CachedForArg()
  private async getInterfacesFromClassType(
    resource: EnhancedResource<any>
  ): Promise<ReadonlyArray<EnhancedResource<any>>> {
    const map = await this.getEnhancedMap();
    const resSet = new Set<EnhancedResource<any>>(Object.values(map));
    return [...resource.interfaces].filter((i) => resSet.has(i));
  }

  @CachedForArg()
  private async getInterfacesFromGQLSchema(
    resource: EnhancedResource<any>
  ): Promise<ReadonlyArray<EnhancedResource<any>>> {
    const { schema } = this.gqlSchema;
    const map = await this.getEnhancedMap();

    const type = schema.getType(resource.name);
    if (!type || !isObjectType(type)) {
      return [];
    }
    return type
      .getInterfaces()
      .flatMap((i) => map[i.name as keyof ResourceMap] ?? []);
  }

  @CachedForArg()
  async getImplementations(
    interfaceResource: EnhancedResource<any>
  ): Promise<ReadonlyArray<EnhancedResource<any>>> {
    const map = await this.getEnhancedMap();
    const impls = Object.values(map).filter((resource) =>
      resource.interfaces.has(interfaceResource)
    );
    return impls;
  }
}

type LegacyMap = typeof LegacyResourceMap;
declare module '~/core/resources/map' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface ResourceMap extends LegacyMap {}
}
