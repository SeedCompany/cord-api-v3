import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ResourceLoader } from '../../core';
import { Changeset, ChangesetAware } from './dto';

@Resolver(ChangesetAware)
export class ChangesetAwareResolver {
  constructor(private readonly resources: ResourceLoader) {}

  @ResolveField()
  async changeset(@Parent() object: ChangesetAware): Promise<Changeset | null> {
    return object.changeset
      ? await this.resources.load(Changeset, object.changeset)
      : null;
  }
}
