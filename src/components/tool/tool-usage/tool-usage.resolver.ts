import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Disabled, type ID, IdArg, mapSecuredValue, Resource } from '~/common';
import { Loader, LoaderOf, ResourceLoader } from '~/core';
import { ActorLoader } from '../../../components/user/actor.loader';
import { Actor } from '../../../components/user/dto';
import { Tool } from '../dto';
import { ToolLoader } from '../tool.loader';
import {
  CreateToolUsage,
  CreateToolUsageOutput,
  DeleteToolUsageOutput,
  ToolUsage,
  UpdateToolUsage,
  UpdateToolUsageOutput,
} from './dto';
import { ToolUsageLoader } from './tool-usage.loader';
import { ToolUsageService } from './tool-usage.service';

@Resolver(ToolUsage)
export class ToolUsageResolver {
  constructor(
    private readonly service: ToolUsageService,
    private readonly resources: ResourceLoader,
  ) {}

  @Query(() => ToolUsage, {
    description: 'Read one tool usage by id',
  })
  async toolUsage(
    @Loader(ToolUsageLoader) toolUsages: LoaderOf<ToolUsageLoader>,
    @IdArg() id: ID,
  ): Promise<ToolUsage> {
    return await toolUsages.load(id);
  }

  @ResolveField(() => Resource)
  async container(@Parent() toolUsage: ToolUsage) {
    return await mapSecuredValue(toolUsage.container, (node) =>
      this.resources.loadByBaseNode(node),
    );
  }

  @ResolveField(() => Tool)
  async tool(
    @Parent() toolUsage: ToolUsage,
    @Loader(ToolLoader) tools: LoaderOf<ToolLoader>,
  ) {
    return await tools.load(toolUsage.tool.id);
  }

  @ResolveField(() => Actor)
  async creator(
    @Parent() toolUsage: ToolUsage,
    @Loader(ActorLoader) actors: LoaderOf<ActorLoader>,
  ) {
    return await actors.load(toolUsage.creator.id);
  }

  @Mutation(() => CreateToolUsageOutput, {
    description: 'Create a tool usage',
  })
  async createToolUsage(
    @Args('input') input: CreateToolUsage,
  ): Promise<CreateToolUsageOutput> {
    const toolUsage = await this.service.create(input);
    return { toolUsage: toolUsage };
  }

  @Disabled(`Stubbing this here for future implementation`)
  @Mutation(() => UpdateToolUsageOutput, {
    description: 'Update a tool usage',
  })
  async updateToolUsage(
    @Args('input') input: UpdateToolUsage,
  ): Promise<UpdateToolUsageOutput> {
    const toolUsage = await this.service.update(input);
    return { toolUsage };
  }

  @Mutation(() => DeleteToolUsageOutput, {
    description: 'Delete a tool usage',
  })
  async deleteToolUsage(@IdArg() id: ID): Promise<DeleteToolUsageOutput> {
    await this.service.delete(id);
    return { success: true };
  }
}
