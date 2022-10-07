import { Injectable } from '@nestjs/common';
import { mapValues } from 'lodash';
import { ValueOf } from 'ts-essentials';
import { LiteralUnion } from 'type-fest';
import { CachedOnArg, EnhancedResource, ServerException } from '~/common';
import type { LegacyResourceMap } from '../../components/authorization/model/resource-map';
import { ResourceMap } from './map';
import { __privateDontUseThis } from './resource-map-holder';

export type EnhancedResourceMap = {
  [K in keyof ResourceMap]: EnhancedResource<ResourceMap[K]>;
};

@Injectable()
export class ResourcesHost {
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
  ): Promise<ValueOf<Pick<ResourceMap, K>>>;
  async getByName(
    name: LiteralUnion<keyof ResourceMap, string>
  ): Promise<ValueOf<ResourceMap>>;
  async getByName(name: keyof ResourceMap) {
    const map = await this.getMap();
    const resource = map[name];
    if (!resource) {
      throw new ServerException(
        `Unable to determine resource from ResourceMap for type: ${name}`
      );
    }
    return resource;
  }

  @CachedOnArg()
  async getInterfaces(
    resource: EnhancedResource<any>
  ): Promise<ReadonlyArray<EnhancedResource<any>>> {
    // Possible change in future to use GQL.
    const map = await this.getEnhancedMap();
    const resSet = new Set<EnhancedResource<any>>(Object.values(map));
    return [...resource.interfaces].filter((i) => resSet.has(i));
  }

  @CachedOnArg()
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
