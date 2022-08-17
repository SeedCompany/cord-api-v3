import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { LoggedInSession, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { ChangesetLoader } from './changeset.loader';
import { ChangesetResolver } from './changeset.resolver';
import { Changeset, ChangesetAware, ChangesetDiff } from './dto';

@Resolver(ChangesetAware)
export class ChangesetAwareResolver {
  constructor(private readonly changesetResolver: ChangesetResolver) {}

  @ResolveField()
  async changeset(
    @Parent() object: ChangesetAware,
    @Loader(ChangesetLoader) changesets: LoaderOf<ChangesetLoader>
  ): Promise<Changeset | null> {
    return object.changeset ? await changesets.load(object.changeset) : null;
  }

  @ResolveField(() => ChangesetDiff, {
    nullable: true,
    description: stripIndent`
      The changes made within this changeset limited to this resource's sub-tree
    `,
  })
  async changesetDiff(
    @Parent() object: ChangesetAware,
    @LoggedInSession() session: Session,
    @Loader(ChangesetLoader) changesets: LoaderOf<ChangesetLoader>
  ): Promise<ChangesetDiff | null> {
    if (!object.changeset) {
      return null;
    }
    const changeset = await changesets.load(object.changeset);
    const diff = await this.changesetResolver.difference(
      changeset,
      session,
      object.id
    );
    return diff;
  }
}
