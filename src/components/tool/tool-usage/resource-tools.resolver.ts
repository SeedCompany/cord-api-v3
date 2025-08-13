import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Resource } from '~/common';
import { ToolUsage } from './dto';
import { ToolUsageService } from './tool-usage.service';

@Resolver(() => Resource, { isAbstract: true })
export class ResourceToolsResolver {
  constructor(private readonly toolUsageService: ToolUsageService) {}

  @ResolveField(() => [ToolUsage], {
    description: 'Tool usages for this resource',
  })
  async tools(@Parent() resource: Resource): Promise<ToolUsage[]> {
    if (resource.__typename === 'ToolUsage' || resource.__typename === 'Tool') {
      return [];
    }
    return await this.toolUsageService.findByContainerId(resource.id);
  }
}
