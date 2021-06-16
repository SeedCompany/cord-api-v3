import { Session } from '../../../common';
import { ProjectChangeRequest, UpdateProjectChangeRequest } from '../dto';

export class ProjectChangeRequestUpdatedEvent {
  constructor(
    public updated: ProjectChangeRequest,
    readonly previous: ProjectChangeRequest,
    readonly updates: UpdateProjectChangeRequest,
    readonly session: Session
  ) {}
}
