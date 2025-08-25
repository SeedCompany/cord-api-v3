import { Injectable, type Type } from '@nestjs/common';
import { many, mapEntries } from '@seedcompany/common';
import { mapValues } from 'lodash';
import { EnhancedResource, type ResourceShape } from '~/common';
import { MetadataDiscovery } from '~/core/discovery';
import { ResourcesHost } from '~/core/resources';
import { Granter } from './builder/granter.decorator';
import {
  DefaultResourceGranter,
  ResourceGranter,
} from './builder/resource-granter';
import { type ResourcesGranter } from './granters';

@Injectable()
export class GrantersFactory {
  constructor(
    private readonly discovery: MetadataDiscovery,
    private readonly resourcesHost: ResourcesHost,
  ) {}

  async makeGranters() {
    const discoveredGranters = this.discovery
      .discover(Granter)
      .classes<ResourceGranter<ResourceShape<any>>>();

    const custom = Object.assign(
      {},
      ...discoveredGranters.map(
        ({ meta: { resources, factory }, instance }) =>
          mapEntries(many(resources), (raw) => {
            const res = EnhancedResource.of(raw);
            const GranterImpl = instance.constructor as Type<ResourcesGranter>;
            const granter = factory?.(res) ?? new GranterImpl(res);
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
