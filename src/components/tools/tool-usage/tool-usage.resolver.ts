import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg, Resource, ServerException } from '~/common';
import { Loader, type LoaderOf, ResourceLoader } from '~/core';
import { ActorLoader } from '../../user/actor.loader';
import { Actor } from '../../user/dto';
import {
  CreateToolUsage,
  CreateToolUsageOutput,
  DeleteToolUsageOutput,
  ToolUsage,
  UpdateToolUsage,
  UpdateToolUsageOutput,
} from './dto';
import { ToolUsageService } from './tool-usage.service';

@Resolver(ToolUsage)
export class ToolUsageResolver {
  constructor(
    private readonly service: ToolUsageService,
    private readonly resources: ResourceLoader,
  ) {}

  @ResolveField(() => Resource)
  async container(@Parent() toolUsage: ToolUsage): Promise<Resource> {
    const container = toolUsage.container.value;
    // Service should have hidden this ToolUsage if the container cannot be read.
    // So we should always have a container when we get here.
    if (!container) {
      throw new ServerException('Container resolution failure');
    }
    return (await this.resources.loadByBaseNode(container)) as Resource;
  }

  @ResolveField(() => Actor)
  async creator(
    @Parent() toolUsage: ToolUsage,
    @Loader(ActorLoader) actors: LoaderOf<ActorLoader>,
  ) {
    return await actors.load(toolUsage.creator.id);
  }

  @Mutation(() => CreateToolUsageOutput)
  async createToolUsage(
    @Args('input') input: CreateToolUsage,
  ): Promise<CreateToolUsageOutput> {
    const toolUsage = await this.service.create(input);
    return { toolUsage: toolUsage };
  }

  @Mutation(() => UpdateToolUsageOutput)
  async updateToolUsage(
    @Args('input') input: UpdateToolUsage,
  ): Promise<UpdateToolUsageOutput> {
    const toolUsage = await this.service.update(input);
    return { toolUsage };
  }

  @Mutation(() => DeleteToolUsageOutput)
  async deleteToolUsage(
    @IdArg() id: ID<ToolUsage>,
  ): Promise<DeleteToolUsageOutput> {
    await this.service.delete(id);
    return { success: true };
  }
}
