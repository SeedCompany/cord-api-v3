import { Injectable } from '@nestjs/common';
import { mapValues } from 'lodash';
import { CachedOnArg, EnhancedResource } from '~/common';
import { ResourceMap } from '../../components/authorization/model/resource-map';

export type EnhancedResourceMap = {
  [K in keyof ResourceMap]: EnhancedResource<ResourceMap[K]>;
};

// TODO Move to ~/core along with resource mapping
@Injectable()
export class ResourcesHost {
  async getMap() {
    // Deferred import until now to prevent circular dependency
    const { ResourceMap } = await import(
      '../../components/authorization/model/resource-map'
    );
    return ResourceMap;
  }

  async getEnhancedMap(): Promise<EnhancedResourceMap> {
    const map = await this.getMap();
    return mapValues(map, EnhancedResource.of) as any;
  }

  async getInterfaces(resource: EnhancedResource<any>) {
    // Possible change in future to use GQL.
    return [...resource.interfaces];
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
