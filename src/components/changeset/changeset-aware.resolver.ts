import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { DataLoader, Loader } from '../../core';
import { Changeset, ChangesetAware } from './dto';

@Resolver(ChangesetAware)
export class ChangesetAwareResolver {
  @ResolveField()
  async changeset(
    @Parent() object: ChangesetAware,
    @Loader(Changeset) changesets: DataLoader<Changeset>
  ): Promise<Changeset | null> {
    return object.changeset ? await changesets.load(object.changeset) : null;
  }
}
