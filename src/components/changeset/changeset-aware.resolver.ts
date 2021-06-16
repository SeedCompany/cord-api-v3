import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '../../common';
import { ChangesetRepository } from './changeset.repository';
import { Changeset, ChangesetAware } from './dto';

@Resolver(ChangesetAware)
export class ChangesetAwareResolver {
  constructor(private readonly repo: ChangesetRepository) {}

  @ResolveField()
  async changeset(
    @Parent() object: ChangesetAware,
    @LoggedInSession() _session: Session
  ): Promise<Changeset | null> {
    return object.changeset ? await this.repo.readOne(object.changeset) : null;
  }
}
