import { type ID } from '~/common';
import {
  type DataLoaderStrategy,
  type LoaderContextType,
  LoaderFactory,
  type LoaderOptionsOf,
} from '~/core/data-loader';
import { type Tool } from '../tool/dto';
import { type ToolContainerSummary } from './dto';
import { ToolUsageService } from './tool-usage.service';

export interface SummaryByTool {
  tool: Tool;
  summary: ToolContainerSummary[];
}

@LoaderFactory()
export class ToolContainerSummaryLoader implements DataLoaderStrategy<
  SummaryByTool,
  Tool,
  ID
> {
  constructor(private readonly usages: ToolUsageService) {}

  getOptions() {
    return {
      propertyKey: ({ tool }) => tool,
      cacheKeyFn: (tool) => tool.id,
    } satisfies LoaderOptionsOf<ToolContainerSummaryLoader>;
  }

  async loadMany(
    tools: readonly Tool[],
    _ctx: LoaderContextType,
  ): Promise<readonly SummaryByTool[]> {
    return await this.usages.readContainerSummaryForTools(tools);
  }
}
