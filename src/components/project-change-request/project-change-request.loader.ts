import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { Changeset } from '../changeset/dto';
import { ProjectChangeRequest } from './dto';
import { ProjectChangeRequestService } from './project-change-request.service';

@LoaderFactory(() => [
  ProjectChangeRequest,
  // Cheat for now and assume concrete type since it is the only one.
  Changeset,
])
export class ProjectChangeRequestLoader implements DataLoaderStrategy<ProjectChangeRequest, ID> {
  constructor(private readonly projectChangeRequests: ProjectChangeRequestService) {}

  async loadMany(ids: readonly ID[]) {
    return await this.projectChangeRequests.readMany(ids);
  }
}
