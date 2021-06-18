import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '../../common';
import { ResourceResolver } from '../../core';
import { BaseNode } from '../../core/database/results';
import { ChangesetRepository } from './changeset.repository';
import { Changeset, ChangesetDiff } from './dto';

@Resolver(Changeset)
export class ChangesetResolver {
  constructor(
    private readonly repo: ChangesetRepository,
    private readonly resources: ResourceResolver
  ) {}

  @ResolveField(() => ChangesetDiff, {
    description: 'The changes that this changeset as made',
  })
  async difference(
    @Parent() changeset: Changeset,
    @LoggedInSession() session: Session
  ): Promise<ChangesetDiff> {
    const diff = await this.repo.difference(changeset.id, session);
    const lookup = (node: BaseNode) =>
      this.resources.lookupByBaseNode(node, session, changeset.id) as any;
    const [added, removed, changed] = await Promise.all([
      Promise.all(diff.added.map(lookup)),
      Promise.all(diff.removed.map(lookup)),
      Promise.all(diff.changed.map(lookup)),
    ]);
    return {
      added,
      removed,
      changed,
    };
  }
}
