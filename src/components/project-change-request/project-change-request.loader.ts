import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { ProjectChangeRequest } from './dto';
import { ProjectChangeRequestService } from './project-change-request.service';

@Injectable({ scope: Scope.REQUEST })
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
