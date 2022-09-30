import { Injectable } from '@nestjs/common';
import { mapValues } from 'lodash';
import { CachedOnArg, EnhancedResource } from '~/common';
import type { ResourceMap as LegacyResourceMap } from '../../components/authorization/model/resource-map';
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
      ...(legacyPath.ResourceMap as object),
    };
    return map;
  }

  async getEnhancedMap(): Promise<EnhancedResourceMap> {
    const map = await this.getMap();
    return mapValues(map, EnhancedResource.of) as any;
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

declare module '~/core/resources/map' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface ResourceMap extends LegacyResourceMap {}
}
