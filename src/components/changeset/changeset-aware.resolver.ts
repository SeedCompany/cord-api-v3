import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '../../core';
import { ChangesetLoader } from './changeset.loader';
import { Changeset, ChangesetAware } from './dto';

@Resolver(ChangesetAware)
export class ChangesetAwareResolver {
  @ResolveField()
  async changeset(
    @Parent() object: ChangesetAware,
    @Loader(ChangesetLoader) changesets: LoaderOf<ChangesetLoader>
  ): Promise<Changeset | null> {
    return object.changeset ? await changesets.load(object.changeset) : null;
  }
}
