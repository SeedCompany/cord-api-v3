import { Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID, IdArg, LoggedInSession, ObjectView, Session } from '../../common';
import { Loader, LoaderOf, ResourceResolver } from '../../core';
import { BaseNode } from '../../core/database/results';
import { ChangesetLoader } from './changeset.loader';
import { ChangesetRepository } from './changeset.repository';
import { Changeset, ChangesetDiff, ResourceChange } from './dto';

@Resolver(Changeset)
export class ChangesetResolver {
  constructor(
    private readonly repo: ChangesetRepository,
    private readonly resources: ResourceResolver
  ) {}

  @Query(() => Changeset)
  async changeset(
    @Loader(() => ChangesetLoader)
    changesets: LoaderOf<ChangesetLoader>,
    @IdArg() id: ID
  ): Promise<Changeset> {
    return await changesets.load(id);
  }

  @ResolveField(() => ChangesetDiff, {
    description: 'The changes that this changeset as made',
  })
  async difference(
    @Parent() changeset: Changeset,
    @LoggedInSession() session: Session,
    parent: ID
  ): Promise<ChangesetDiff> {
    const isApproved = await this.repo.isApproved(changeset.id, session);
    const diff = await this.repo.difference(changeset.id, session, parent);
    const lookup = (node: BaseNode, view?: ObjectView) =>
      this.resources.lookupByBaseNode(
        node,
        session,
        view ?? {
          changeset: changeset.id,
        }
      );
    const [added, removed, changed] = await Promise.all([
      Promise.all(diff.added.map((node) => lookup(node))),
      // If the changeset is approved, we read deleted node otherwise read node in changeset
      Promise.all(
        diff.removed.map((node) =>
          lookup(node, isApproved ? { deleted: true } : undefined)
        )
      ),
      Promise.all(
        diff.changed.map(async (node): Promise<ResourceChange> => {
          const [previous, updated] = await Promise.all([
            this.resources.lookupByBaseNode(node, session),
            lookup(node),
          ]);
          return { previous, updated };
        })
      ),
    ]);
    return {
      added,
      removed,
      changed,
    };
  }
}
