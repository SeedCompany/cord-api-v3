import { Injectable } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { CachedByArg } from '@seedcompany/common';
import { isObjectType } from 'graphql';
import { mapValues } from 'lodash';
import { LiteralUnion, ValueOf } from 'type-fest';
import {
  EnhancedResource,
  InvalidIdForTypeException,
  ResourceShape,
  ServerException,
} from '~/common';
import { ResourceMap } from './map';
import { __privateDontUseThis } from './resource-map-holder';

export type EnhancedResourceMap = {
  [K in keyof ResourceMap]: EnhancedResource<ResourceMap[K]>;
};

type LooseResourceName = LiteralUnion<keyof ResourceMap, string>;

export type ResourceLike =
  | ResourceShape<any>
  | EnhancedResource<any>
  | LooseResourceName;

@Injectable()
export class ResourcesHost {
  constructor(private readonly gqlSchema: GraphQLSchemaHost) {}

  async getMap() {
    // @ts-expect-error Yeah we are assuming each type has been correctly
    // registered & type declared.
    const map: ResourceMap = {
      ...__privateDontUseThis,
    };
    return map;
  }

  async getNames() {
    const map = await this.getMap();
    return Object.keys(map) as Array<keyof ResourceMap>;
  }

  async getEnhancedMap(): Promise<EnhancedResourceMap> {
    const map = await this.getMap();
    return mapValues(map, EnhancedResource.of) as any;
  }

  async getByName<K extends keyof ResourceMap>(
    name: K,
  ): Promise<EnhancedResource<ValueOf<Pick<ResourceMap, K>>>> {
    const map = await this.getEnhancedMap();
    const resource = map[name];
    if (!resource) {
      throw new ServerException(
        `Unable to determine resource from ResourceMap for type: ${name}`,
      );
    }
    return resource;
  }

  async getByDynamicName(
    name: LooseResourceName,
  ): Promise<EnhancedResource<ValueOf<ResourceMap>>> {
    return await this.getByName(name as any);
  }

  async verifyImplements(resource: ResourceLike, theInterface: ResourceLike) {
    const iface = await this.enhance(theInterface);
    if (!(await this.doesImplement(resource, iface))) {
      throw new InvalidIdForTypeException(
        `Resource does not implement ${iface.name}`,
      );
    }
  }

  async doesImplement(resource: ResourceLike, theInterface: ResourceLike) {
    const interfaces = await this.getInterfaces(await this.enhance(resource));
    return interfaces.includes(await this.enhance(theInterface));
  }

  async enhance(ref: ResourceLike) {
    // Safety check, since this very dynamic code, it's very possible the types are lying.
    // @eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (ref == null) {
      throw new ServerException('Resource reference is actually null');
    }
    return typeof ref === 'string'
      ? await this.getByDynamicName(ref)
      : EnhancedResource.of(ref);
  }

  async getInterfaces(
    resource: EnhancedResource<any>,
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

  @CachedByArg()
  private async getInterfacesFromClassType(
    resource: EnhancedResource<any>,
  ): Promise<ReadonlyArray<EnhancedResource<any>>> {
    const map = await this.getEnhancedMap();
    const resSet = new Set<EnhancedResource<any>>(Object.values(map));
    return [...resource.interfaces].filter((i) => resSet.has(i));
  }

  @CachedByArg()
  private async getInterfacesFromGQLSchema(
    resource: EnhancedResource<any>,
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

  @CachedByArg()
  async getImplementations(
    interfaceResource: EnhancedResource<any>,
  ): Promise<ReadonlyArray<EnhancedResource<any>>> {
    const map = await this.getEnhancedMap();
    const impls = Object.values(map).filter((resource) =>
      resource.interfaces.has(interfaceResource),
    );
    return impls;
  }
}
