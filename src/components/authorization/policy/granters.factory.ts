import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { Injectable } from '@nestjs/common';
import { mapValues } from 'lodash';
import { EnhancedResource, many, mapFromList } from '~/common';
import { ResourcesHost } from '~/core/resources';
import { discover } from './builder/granter.decorator';
import {
  DefaultResourceGranter,
  ResourceGranter,
} from './builder/resource-granter';
import { ResourcesGranter } from './granters';

@Injectable()
export class GrantersFactory {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly resourcesHost: ResourcesHost
  ) {}

  async makeGranters() {
    const discoveredGranters = await discover(this.discovery);

    const custom = Object.assign(
      {},
      ...discoveredGranters.map(
        ({ meta: { resources, factory }, discoveredClass }) => {
          return mapFromList(many(resources), (raw) => {
            const res = EnhancedResource.of(raw);
            const granter =
              factory?.(res) ?? new discoveredClass.dependencyType(res);
            return [res.name, granter];
          });
        }
      )
    );

    const ResourceMap = await this.resourcesHost.getEnhancedMap();

    const resGranter: ResourcesGranter = mapValues(
      ResourceMap,
      (resource: EnhancedResource<any>) =>
        custom[resource.name] ?? new DefaultResourceGranter(resource)
    ) as any;

    return resGranter;
  }
}
