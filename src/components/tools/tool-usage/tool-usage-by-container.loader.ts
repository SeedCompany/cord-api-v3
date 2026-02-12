import { type ID, type Resource } from '~/common';
import {
  type DataLoaderStrategy,
  type LoaderContextType,
  LoaderFactory,
  type LoaderOptionsOf,
} from '~/core/data-loader';
import { ToolLoader } from '../tool/tool.loader';
import { type SecuredToolUsageList } from './dto';
import { ToolUsageLoader } from './tool-usage.loader';
import { ToolUsageService } from './tool-usage.service';

export interface UsagesByContainer {
  container: Resource;
  usages: SecuredToolUsageList;
}

@LoaderFactory()
export class ToolUsageByContainerLoader implements DataLoaderStrategy<
  UsagesByContainer,
  Resource,
  ID
> {
  constructor(private readonly usages: ToolUsageService) {}

  getOptions() {
    return {
      propertyKey: ({ container }) => container,
      cacheKeyFn: (container) => container.id,
    } satisfies LoaderOptionsOf<ToolUsageByContainerLoader>;
  }

  async loadMany(
    ids: readonly Resource[],
    ctx: LoaderContextType,
  ): Promise<readonly UsagesByContainer[]> {
    const res = await this.usages.readManyForContainers(ids);

    const canonicalUsages = await ctx.getLoader(ToolUsageLoader);
    const usages = res.flatMap((u) => u.usages.items);
    canonicalUsages.primeAll(usages);

    const canonicalTools = await ctx.getLoader(ToolLoader);
    canonicalTools.primeAll(usages.map((x) => x.tool));

    return res;
  }
}
