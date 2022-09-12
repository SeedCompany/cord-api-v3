import { Injectable } from '@nestjs/common';
import { ValueOf } from 'ts-essentials';
import { getParentTypes, ResourceShape } from '~/common';
import { ResourceMap } from '../model/resource-map';

// TODO Move to ~/core along with resource mapping
@Injectable()
export class ResourcesHost {
  async getMap() {
    // Deferred import until now to prevent circular dependency
    const { ResourceMap } = await import('../model/resource-map');
    return ResourceMap;
  }

  async getImplementations(
    interfaceResource:
      | ValueOf<ResourceMap>
      | keyof ResourceMap
      | ResourceShape<any>
  ): Promise<ReadonlyArray<ValueOf<ResourceMap>>> {
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
