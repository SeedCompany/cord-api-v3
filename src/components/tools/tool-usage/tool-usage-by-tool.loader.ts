import type { LoaderContextType } from '@seedcompany/data-loader';
import { type ID } from '~/common';
import {
  type DataLoaderStrategy,
  LoaderFactory,
  type LoaderOptionsOf,
} from '~/core/data-loader';
import { type Tool } from '../tool/dto';
import { type ToolUsage } from './dto';
import { ToolUsageLoader } from './tool-usage.loader';
import { ToolUsageService } from './tool-usage.service';

export interface UsagesByTool {
  tool: Tool;
  usages: readonly ToolUsage[];
}

@LoaderFactory()
export class ToolUsageByToolLoader
  implements DataLoaderStrategy<UsagesByTool, Tool, ID>
{
  constructor(private readonly usages: ToolUsageService) {}

  getOptions() {
    return {
      propertyKey: ({ tool }) => tool,
      cacheKeyFn: (tool) => tool.id,
    } satisfies LoaderOptionsOf<ToolUsageByToolLoader>;
  }

  async loadMany(
    tools: readonly Tool[],
    ctx: LoaderContextType,
  ): Promise<readonly UsagesByTool[]> {
    const res = await this.usages.readManyForTools(tools);

    const canonicalUsages = await ctx.getLoader(ToolUsageLoader);
    const usages = res.flatMap((u) => u.usages);
    canonicalUsages.primeAll(usages);

    return res;
  }
}
