import { ID } from '../../common';
import { LoaderFactory, OrderedNestDataLoader } from '../../core';
import { ProjectChangeRequest } from './dto';
import { ProjectChangeRequestService } from './project-change-request.service';

@LoaderFactory(() => ProjectChangeRequest)
export class ProjectChangeRequestLoader extends OrderedNestDataLoader<ProjectChangeRequest> {
  constructor(
    private readonly projectChangeRequests: ProjectChangeRequestService
  ) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.projectChangeRequests.readMany(ids, this.session);
  }
}
