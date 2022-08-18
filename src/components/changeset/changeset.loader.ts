import { ID } from '../../common';
import { LoaderFactory, ResourceResolver, SingleItemLoader } from '../../core';
import { ProjectChangeRequest } from '../project-change-request/dto';
import { Changeset } from './dto';

/**
 * Since we are really just using this for caching, SingleItemLoader should be fine.
 * We don't have a use case currently for asking for multiple different changesets.
 */
@LoaderFactory(() => Changeset)
export class ChangesetLoader extends SingleItemLoader<Changeset> {
  constructor(private readonly resources: ResourceResolver) {
    super();
  }

  async loadOne(id: ID): Promise<Changeset> {
    // Cheat for now and assume concrete type since it is the only one.
    // May need BaseNode lookup in future.
    return await this.resources.lookup(ProjectChangeRequest, id, this.session);
  }
}
