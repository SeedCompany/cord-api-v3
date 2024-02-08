import { Injectable } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { CachedByArg, mapKeys } from '@seedcompany/common';
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

  getMap() {
    // @ts-expect-error Yeah we are assuming each type has been correctly
    // registered & type declared.
    const map: ResourceMap = {
      ...__privateDontUseThis,
    };
    return map;
  }

  getNames() {
    const map = this.getMap();
    return Object.keys(map) as Array<keyof ResourceMap>;
  }

  @CachedByArg()
  getEnhancedMap(): EnhancedResourceMap {
    const map = this.getMap();
    return mapValues(map, EnhancedResource.of) as any;
  }

  getByName<K extends keyof ResourceMap>(
    name: K,
  ): EnhancedResource<ValueOf<Pick<ResourceMap, K>>> {
    const map = this.getEnhancedMap();
    const resource = map[name];
    if (!resource) {
      throw new ServerException(
        `Unable to determine resource from ResourceMap for type: ${name}`,
      );
    }
    return resource;
  }

  getByDynamicName(name: LooseResourceName): EnhancedResource<any> {
    return this.getByName(name as any);
  }

  getByEdgeDB(name: string): EnhancedResource<ValueOf<ResourceMap>> {
    const fqnMap = this.edgeDBFQNMap();
    const resByFQN = fqnMap.get(
      name.includes('::') ? name : `default::${name}`,
    );
    if (resByFQN) {
      return resByFQN;
    }
    const nameMap = this.getEnhancedMap();
    const resByName = nameMap[name as keyof ResourceMap];
    if (resByName) {
      return resByName as any;
    }
    throw new ServerException(
      `Unable to determine resource from ResourceMap for EdgeDB FQN: ${name}`,
    );
  }

  @CachedByArg()
  private edgeDBFQNMap() {
    const map = this.getEnhancedMap();
    const fqnMap = mapKeys(
      map as Record<string, EnhancedResource<any>>,
      (_, r, { SKIP }) => {
        try {
          return r.dbFQN;
        } catch (e) {
          return SKIP;
        }
      },
    ).asMap;
    return fqnMap;
  }

  verifyImplements(resource: ResourceLike, theInterface: ResourceLike) {
    const iface = this.enhance(theInterface);
    if (!this.doesImplement(resource, iface)) {
      throw new InvalidIdForTypeException(
        `Resource does not implement ${iface.name}`,
      );
    }
  }

  doesImplement(resource: ResourceLike, theInterface: ResourceLike) {
    const interfaces = this.getInterfaces(this.enhance(resource));
    return interfaces.includes(this.enhance(theInterface));
  }

  enhance(ref: ResourceLike) {
    // Safety check, since this very dynamic code, it's very possible the types are lying.
    // @eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (ref == null) {
      throw new ServerException('Resource reference is actually null');
    }
    return typeof ref === 'string'
      ? this.getByDynamicName(ref)
      : EnhancedResource.of(ref);
  }

  getInterfaces(
    resource: EnhancedResource<any>,
  ): ReadonlyArray<EnhancedResource<any>> {
    // Use interfaces from GQL schema if it's available.
    // Otherwise, fallback to the interfaces from DTO class hierarchy.
    // The former doesn't work with CLI.
    // The latter doesn't work for IntersectionTypes.
    // Hoping to resolve with https://github.com/nestjs/graphql/pull/2435
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      this.gqlSchema.schema;
    } catch (e) {
      return this.getInterfacesFromClassType(resource);
    }
    return this.getInterfacesFromGQLSchema(resource);
  }

  @CachedByArg()
  private getInterfacesFromClassType(
    resource: EnhancedResource<any>,
  ): ReadonlyArray<EnhancedResource<any>> {
    const map = this.getEnhancedMap();
    const resSet = new Set<EnhancedResource<any>>(Object.values(map));
    return [...resource.interfaces].filter((i) => resSet.has(i));
  }

  @CachedByArg()
  private getInterfacesFromGQLSchema(
    resource: EnhancedResource<any>,
  ): ReadonlyArray<EnhancedResource<any>> {
    const { schema } = this.gqlSchema;
    const map = this.getEnhancedMap();

    const type = schema.getType(resource.name);
    if (!type || !isObjectType(type)) {
      return [];
    }
    return type
      .getInterfaces()
      .flatMap((i) => map[i.name as keyof ResourceMap] ?? []);
  }

  @CachedByArg()
  getImplementations(
    interfaceResource: EnhancedResource<any>,
  ): ReadonlyArray<EnhancedResource<any>> {
    const map = this.getEnhancedMap();
    const impls = Object.values(map).filter((resource) =>
      resource.interfaces.has(interfaceResource),
    );
    return impls;
  }
}
