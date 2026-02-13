import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { type ID, IdArg, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import {
  CreateTool,
  Tool,
  ToolCreated,
  ToolDeleted,
  ToolListInput,
  ToolListOutput,
  ToolUpdated,
  UpdateTool,
} from './dto';
import { ToolLoader } from './tool.loader';
import { ToolService } from './tool.service';

@Resolver(Tool)
export class ToolResolver {
  constructor(private readonly toolService: ToolService) {}

  @Query(() => Tool, {
    description: 'Look up a tool by its ID',
  })
  async tool(
    @Loader(ToolLoader) tools: LoaderOf<ToolLoader>,
    @IdArg() id: ID<Tool>,
  ): Promise<Tool> {
    return await tools.load(id);
  }

  @Query(() => ToolListOutput, {
    description: 'Look up tools',
  })
  async tools(
    @ListArg(ToolListInput) input: ToolListInput,
    @Loader(ToolLoader) tools: LoaderOf<ToolLoader>,
  ): Promise<ToolListOutput> {
    const list = await this.toolService.list(input);
    tools.primeAll(list.items);
    return list;
  }

  @Mutation(() => ToolCreated, {
    description: 'Create a tool',
  })
  async createTool(@Args('input') input: CreateTool): Promise<ToolCreated> {
    const tool = await this.toolService.create(input);
    return { tool };
  }

  @Mutation(() => ToolUpdated, {
    description: 'Update a tool',
  })
  async updateTool(@Args('input') input: UpdateTool): Promise<ToolUpdated> {
    const tool = await this.toolService.update(input);
    return { tool };
  }

  @Mutation(() => ToolDeleted, {
    description: 'Delete a tool',
  })
  async deleteTool(@IdArg() id: ID): Promise<ToolDeleted> {
    await this.toolService.delete(id);
    return {};
  }
}
