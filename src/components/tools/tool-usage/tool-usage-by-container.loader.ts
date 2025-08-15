import { type ID, type Resource } from '~/common';
import {
  type DataLoaderStrategy,
  LoaderFactory,
  type LoaderOptionsOf,
} from '~/core/data-loader';
import { type ToolUsage } from './dto';
import { ToolUsageService } from './tool-usage.service';

export interface UsagesByContainer {
  container: Resource;
  usages: readonly ToolUsage[];
}

@LoaderFactory()
export class ToolUsageByContainerLoader
  implements DataLoaderStrategy<UsagesByContainer, Resource, ID>
{
  constructor(private readonly usages: ToolUsageService) {}

  getOptions() {
    return {
      propertyKey: ({ container }) => container,
      cacheKeyFn: (container) => container.id,
    } satisfies LoaderOptionsOf<ToolUsageByContainerLoader>;
  }

  async loadMany(
    ids: readonly Resource[],
  ): Promise<readonly UsagesByContainer[]> {
    return await this.usages.readManyForContainers(ids);
  }
}
