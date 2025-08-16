import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { Tool } from '../tool/dto';
import { ToolUsage } from './dto';
import { ToolUsageByToolLoader } from './tool-usage-by-tool.loader';

@Resolver(() => Tool)
export class ToolUsagesResolver {
  @ResolveField(() => [ToolUsage], {
    description: 'The usages of this tool',
  })
  async usages(
    @Parent() tool: Tool,
    @Loader(() => ToolUsageByToolLoader)
    loader: LoaderOf<ToolUsageByToolLoader>,
  ): Promise<readonly ToolUsage[]> {
    const { usages } = await loader.load(tool);
    return usages;
  }
}
