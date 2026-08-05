import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  type ID,
  IdArg,
  loadManyIgnoreMissingThrowAny,
  Resource,
  ServerException,
} from '~/common';
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
   * Who recorded this usage, or null once that person has been removed.
   *
   * Nullable is Rob's call (2026-07-30). The `creator_id` column is NOT NULL and
   * always holds an id, but soft-deleting a user leaves the row pointing at
   * someone the actor loader deliberately no longer returns. This field used to be
   * non-null and simply loaded the id, so that raised "could not find" — and
   * because a non-null field cannot report the failure in place, GraphQL nulls the
   * usage, then the usage list, then whatever object holds it. `Resource.tools` is
   * declared on the `Resource` interface, so a departed staff member took out
   * pages across dozens of types that have nothing to do with tools.
   *
   * A deliberate difference from Neo4j, not an oversight: its query requires the
   * creator to match and soft delete relabels the node, so over there the usage
   * disappears entirely. Keeping the usage and blanking the creator shows MORE
   * than Neo4j does, which is the right way round — the usage is a true fact about
   * the resource, and who recorded it is the part that has gone.
   *
   * `loadManyIgnoreMissingThrowAny` rather than a bare try/catch, so only
   * not-found turns into null; any other error still throws instead of being
   * quietly reported as "no creator".
   */
  @ResolveField(() => Actor, { nullable: true })
  async creator(
    @Parent() toolUsage: ToolUsage,
    @Loader(ActorLoader) actors: LoaderOf<ActorLoader>,
  ) {
    const [creator] = await loadManyIgnoreMissingThrowAny(actors, [
      toolUsage.creator.id,
    ]);
    return creator ?? null;
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
