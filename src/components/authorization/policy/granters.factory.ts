import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { Injectable } from '@nestjs/common';
import { many, mapEntries } from '@seedcompany/common';
import { mapValues } from 'lodash';
import { EnhancedResource } from '~/common';
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
    private readonly resourcesHost: ResourcesHost,
  ) {}

  async makeGranters() {
    const discoveredGranters = await discover(this.discovery);

    const custom = Object.assign(
      {},
      ...discoveredGranters.map(
        ({ meta: { resources, factory }, discoveredClass }) =>
          mapEntries(many(resources), (raw) => {
            const res = EnhancedResource.of(raw);
            const granter =
              factory?.(res) ?? new discoveredClass.dependencyType(res);
            if (!(granter instanceof ResourceGranter)) {
              throw new Error(
                `Granter for ${res.name} must extend ResourceGranter class`,
              );
            }
            return [res.name, granter];
          }).asRecord,
      ),
    );

    const ResourceMap = this.resourcesHost.getEnhancedMap();

    const resGranter: ResourcesGranter = mapValues(
      ResourceMap,
      (resource: EnhancedResource<any>) =>
        custom[resource.name] ?? new DefaultResourceGranter(resource),
    ) as any;

    return resGranter;
  }
}
