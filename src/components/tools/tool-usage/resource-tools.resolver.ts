import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { Resource } from '~/common';
import { ToolUsage } from './dto';
import { ToolUsageByContainerLoader } from './tool-usage-by-container.loader';

@Resolver(() => Resource)
export class ResourceToolsResolver {
  @ResolveField(() => [ToolUsage], {
    description: 'Tools used in this resource',
  })
  async tools(
    @Parent() resource: Resource,
    @Loader(() => ToolUsageByContainerLoader)
    loader: LoaderOf<ToolUsageByContainerLoader>,
  ): Promise<readonly ToolUsage[]> {
    const { usages } = await loader.load(resource);
    return usages;
  }
}
