import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Disabled, type ID, IdArg } from '~/common';
import { Loader, LoaderOf, ResourceLoader } from '~/core';
import { SecuredTool, type Tool } from '../dto';
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
    private readonly resourceService: ResourceLoader,
  ) {}

  @Query(() => ToolUsage, {
    description: 'Read one field region by id',
  })
  async toolUsage(
    @Loader(ToolUsageLoader) toolUsages: LoaderOf<ToolUsageLoader>,
    @IdArg() id: ID,
  ): Promise<ToolUsage> {
    return await toolUsages.load(id);
  }

  @ResolveField(() => SecuredTool)
  async tool(
    @Parent() toolUsage: ToolUsage,
    @Loader(ToolLoader) tools: LoaderOf<ToolLoader>,
  ): Promise<Tool> {
    // eslint-disable-next-line no-console
    console.log('toolUsage.tool:', toolUsage.tool);
    // const result = await mapSecuredValue(toolUsage.tool, ({ id }) =>
    //   tools.load(id),
    // );
    const result = await tools.load(toolUsage.tool.value!.id);
    // eslint-disable-next-line no-console
    console.log('Result', result);
    return result;
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
