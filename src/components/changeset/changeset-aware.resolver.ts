import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '../../common';
import { ResourceResolver } from '../../core';
import { ProjectChangeRequest } from '../project-change-request/dto';
import { Changeset, ChangesetAware } from './dto';

@Resolver(ChangesetAware)
export class ChangesetAwareResolver {
  constructor(private readonly resources: ResourceResolver) {}

  @ResolveField()
  async changeset(
    @Parent() object: ChangesetAware,
    @LoggedInSession() session: Session
  ): Promise<Changeset | null> {
    if (!object.changeset) {
      return null;
    }

    // Cheat for now and assume concrete type since it is the only one.
    // May need BaseNode lookup in future.
    // eslint-disable-next-line @typescript-eslint/return-await -- false positive
    return await this.resources.lookup(
      ProjectChangeRequest,
      object.changeset,
      session
    );
  }
}
