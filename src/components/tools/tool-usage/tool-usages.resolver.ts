import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { Tool } from '../tool/dto';
import {
  SecuredToolUsageList,
  ToolContainerSummary,
  ToolUsageListInput,
} from './dto';
import { ToolContainerSummaryLoader } from './tool-container-summary.loader';
import { ToolUsageByToolLoader } from './tool-usage-by-tool.loader';
import { ToolUsageService } from './tool-usage.service';

@Resolver(() => Tool)
export class ToolUsagesResolver {
  constructor(private readonly service: ToolUsageService) {}

  @ResolveField(() => SecuredToolUsageList, {
    description: 'The usages of this tool',
  })
  async usages(
    @Parent() tool: Tool,
    @Loader(() => ToolUsageByToolLoader)
    loader: LoaderOf<ToolUsageByToolLoader>,
  ): Promise<SecuredToolUsageList> {
    const { usages } = await loader.load(tool);
    return usages;
  }

  @ResolveField(() => SecuredToolUsageList, {
    description: 'Tool usages with optional filtering by container type',
  })
  async filteredUsages(
    @Parent() tool: Tool,
    @ListArg(ToolUsageListInput) input: ToolUsageListInput,
  ): Promise<SecuredToolUsageList> {
    return await this.service.readForTool(tool, input.filter);
  }

  @ResolveField(() => [ToolContainerSummary], {
    description:
      'Distinct container types in use and their counts — for tab display',
  })
  async containerSummary(
    @Parent() tool: Tool,
    @Loader(() => ToolContainerSummaryLoader)
    loader: LoaderOf<ToolContainerSummaryLoader>,
  ): Promise<ToolContainerSummary[]> {
    return (await loader.load(tool)).summary;
  }
}
