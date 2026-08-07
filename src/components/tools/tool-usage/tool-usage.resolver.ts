import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg, Resource, ServerException } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { ResourceLoader } from '~/core/resources';
import { ActorLoader } from '../../user/actor.loader';
import { Actor } from '../../user/dto';
import {
  CreateToolUsage,
  ToolUsage,
  ToolUsageCreated,
  ToolUsageDeleted,
  ToolUsageUpdated,
  UpdateToolUsage,
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

  /**
   * Who recorded this usage.
   *
   * Kept non-null on purpose (2026-08-07 reversal of the 2026-07-30 nullable
   * attempt): flipping this to nullable is a real breaking schema change for
   * every GraphQL consumer, and that's a conversation to have on its own
   * timeline, not something to fold into the migration cutover. Parity with
   * Neo4j is what the cutover needs, and Neo4j's query requires the creator to
   * match, so a soft-deleted creator makes the whole usage disappear over
   * there rather than surfacing with a blank field. The repository now does
   * the same — it drops any usage whose creator has been removed before this
   * resolver ever runs — so the actor here is guaranteed to still exist.
   */
  @ResolveField(() => Actor)
  async creator(
    @Parent() toolUsage: ToolUsage,
    @Loader(ActorLoader) actors: LoaderOf<ActorLoader>,
  ) {
    return await actors.load(toolUsage.creator.id);
  }

  @Mutation(() => ToolUsageCreated)
  async createToolUsage(
    @Args('input') input: CreateToolUsage,
  ): Promise<ToolUsageCreated> {
    const toolUsage = await this.service.create(input);
    return { toolUsage: toolUsage };
  }

  @Mutation(() => ToolUsageUpdated)
  async updateToolUsage(
    @Args('input') input: UpdateToolUsage,
  ): Promise<ToolUsageUpdated> {
    const toolUsage = await this.service.update(input);
    return { toolUsage };
  }

  @Mutation(() => ToolUsageDeleted)
  async deleteToolUsage(@IdArg() id: ID<ToolUsage>): Promise<ToolUsageDeleted> {
    await this.service.delete(id);
    return {};
  }
}
