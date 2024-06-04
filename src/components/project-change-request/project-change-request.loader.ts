import { ID } from '~/common';
import { LoaderFactory, OrderedNestDataLoader } from '~/core';
import { Changeset } from '../changeset/dto';
import { ProjectChangeRequest } from './dto';
import { ProjectChangeRequestService } from './project-change-request.service';

@LoaderFactory(() => [
  ProjectChangeRequest,
  // Cheat for now and assume concrete type since it is the only one.
  Changeset,
])
export class ProjectChangeRequestLoader extends OrderedNestDataLoader<ProjectChangeRequest> {
  constructor(
    private readonly projectChangeRequests: ProjectChangeRequestService,
  ) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.projectChangeRequests.readMany(ids, this.session);
  }
}
