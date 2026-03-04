import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Resource } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { SecuredToolUsageList } from './dto';
import { ToolUsageByContainerLoader } from './tool-usage-by-container.loader';

@Resolver(() => Resource)
export class ResourceToolsResolver {
  @ResolveField(() => SecuredToolUsageList, {
    description: 'Tools used in this resource',
  })
  async tools(
    @Parent() resource: Resource,
    @Loader(() => ToolUsageByContainerLoader)
    loader: LoaderOf<ToolUsageByContainerLoader>,
  ): Promise<SecuredToolUsageList> {
    const { usages } = await loader.load(resource);
    return usages;
  }
}
