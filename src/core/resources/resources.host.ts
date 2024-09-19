import { Injectable } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { CachedByArg, mapKeys } from '@seedcompany/common';
import { isObjectType } from 'graphql';
import { LazyGetter as Once } from 'lazy-get-decorator';
import { mapValues } from 'lodash';
import {
  EnhancedResource,
  InvalidIdForTypeException,
  Resource,
  ResourceShape,
  ServerException,
} from '~/common';
import { e } from '../edgedb/reexports';
import { ResourceMap } from './map';
import { __privateDontUseThis } from './resource-map-holder';
import {
  AllResourceNames,
  ResourceName,
  ResourceNameLike,
  ResourceStaticFromName,
} from './resource-name.types';
import { RegisterResource } from './resource.decorator';

export type EnhancedResourceMap = {
  [K in keyof ResourceMap]: EnhancedResource<ResourceMap[K]>;
};

export type ResourceLike =
  | ResourceShape<any>
  | EnhancedResource<any>
  | ResourceNameLike;

RegisterResource({ db: e.Resource })(Resource);
declare module '~/core/resources/map' {
  interface ResourceMap {
    Resource: typeof Resource;
  }
  interface ResourceDBMap {
    Resource: typeof e.Resource;
  }
}

@Injectable()
export class ResourcesHost {
  constructor(private readonly gqlSchema: GraphQLSchemaHost) {
    EnhancedResource.resourcesHost = this;
  }

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

  getByName<Name extends AllResourceNames>(
    name: Name,
  ): EnhancedResource<ResourceStaticFromName<ResourceName<Name>>> {
    if (name.includes('::')) {
      return this.getByEdgeDB(name) as any;
    }
    const map = this.getEnhancedMap();
    const resource = map[name as keyof ResourceMap];
    if (!resource) {
      throw new ServerException(
        `Unable to determine resource from ResourceMap for type: ${name}`,
      );
    }
    return resource as any;
  }

  getByDynamicName(name: ResourceNameLike): EnhancedResource<any> {
    return this.getByName(name as any);
  }

  getByEdgeDB<Name extends ResourceNameLike>(
    name: Name,
  ): EnhancedResource<
    string extends Name
      ? ResourceShape<any>
      : ResourceStaticFromName<ResourceName<Name>>
  > {
    const resByFQN = this.byEdgeFQN.get(
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

  @Once() get byEdgeFQN() {
    const map = this.getEnhancedMap();
    const fqnMap = mapKeys(
      map as Record<string, EnhancedResource<any>>,
      (_, r, { SKIP }) => (r.hasDB ? r.dbFQN : SKIP),
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

  @CachedByArg()
  getInterfaces(
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
