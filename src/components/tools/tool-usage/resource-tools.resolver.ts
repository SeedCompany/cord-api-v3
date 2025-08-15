import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Resource } from '~/common';
import { ToolUsage } from './dto';
import { ToolUsageService } from './tool-usage.service';

@Resolver(() => Resource)
export class ResourceToolsResolver {
  constructor(private readonly toolUsageService: ToolUsageService) {}

  @ResolveField(() => [ToolUsage], {
    description: 'Tools used in this resource',
  })
  async tools(@Parent() resource: Resource): Promise<readonly ToolUsage[]> {
    return await this.toolUsageService.readByContainer(resource);
  }
}
