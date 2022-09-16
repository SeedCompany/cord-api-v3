import { Injectable } from '@nestjs/common';
import { mapValues } from 'lodash';
import { ValueOf } from 'ts-essentials';
import { EnhancedResource, getParentTypes, ResourceShape } from '~/common';
import { ResourceMap } from '../model/resource-map';

export type EnhancedResourceMap = {
  [K in keyof ResourceMap]: EnhancedResource<ResourceMap[K]>;
};

// TODO Move to ~/core along with resource mapping
@Injectable()
export class ResourcesHost {
  async getMap() {
    // Deferred import until now to prevent circular dependency
    const { ResourceMap } = await import('../model/resource-map');
    return ResourceMap;
  }

  async getEnhancedMap(): Promise<EnhancedResourceMap> {
    const map = await this.getMap();
    return mapValues(map, EnhancedResource.of) as any;
  }

  async getImplementations(
    interfaceResource:
      | ValueOf<ResourceMap>
      | keyof ResourceMap
      | ResourceShape<any>
      | EnhancedResource<any>
  ): Promise<ReadonlyArray<ValueOf<ResourceMap>>> {
    interfaceResource =
      interfaceResource instanceof EnhancedResource
        ? interfaceResource.type
        : interfaceResource;

    // TODO do once & cache
    const map = await this.getMap();
    const interfaceResourceObj =
      typeof interfaceResource === 'string'
        ? map[interfaceResource]
        : interfaceResource;

    const impls = Object.values(map).filter((resource) => {
      return (
        resource !== interfaceResourceObj &&
        getParentTypes(resource).includes(interfaceResourceObj as any)
      );
    });
    return impls;
  }
}
