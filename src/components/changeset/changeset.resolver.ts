import { Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { type ID, IdArg, type ObjectView } from '~/common';
import { ResourceLoader } from '~/core';
import { Identity } from '~/core/authentication';
import { type BaseNode } from '~/core/database/results';
import { ChangesetRepository } from './changeset.repository';
import { Changeset, ChangesetDiff, type ResourceChange } from './dto';

@Resolver(Changeset)
export class ChangesetResolver {
  constructor(
    private readonly repo: ChangesetRepository,
    private readonly resources: ResourceLoader,
    private readonly identity: Identity,
  ) {}

  @Query(() => Changeset)
  async changeset(@IdArg() id: ID): Promise<Changeset> {
    return await this.resources.load(Changeset, id);
  }

  @ResolveField(() => ChangesetDiff, {
    description: 'The changes that this changeset as made',
  })
  async difference(
    @Parent() changeset: Changeset,
    @IdArg({
      name: 'resource',
      nullable: true,
      description:
        'Optionally limit to only changes of this resource and its (grand)children',
    })
    parent?: ID,
  ): Promise<ChangesetDiff> {
    // TODO move to auth policy
    if (this.identity.isAnonymous) {
      return { added: [], removed: [], changed: [] };
    }

    const diff = await this.repo.difference(changeset.id, parent);
    const load = (node: BaseNode, view?: ObjectView) =>
      this.resources.loadByBaseNode(node, view ?? { changeset: changeset.id });
    const [added, removed, changed] = await Promise.all([
      Promise.all(diff.added.map((node) => load(node))),
      // If the changeset is approved, we read deleted node otherwise read node in changeset
      Promise.all(
        diff.removed.map((node) =>
          load(node, changeset.applied ? { deleted: true } : undefined),
        ),
      ),
      Promise.all(
        diff.changed.map(async (node): Promise<ResourceChange> => {
          const [previous, updated] = await Promise.all([
            load(node, { active: true }),
            load(node),
          ]);
          return { previous, updated };
        }),
      ),
    ]);
    return {
      added,
      removed,
      changed,
    };
  }
}
