import { Session } from '../../../common';
import { Project, UpdateProject } from '../dto';

export class ProjectUpdatedEvent {
  constructor(
    public updated: Project,
    readonly previous: Project,
    readonly updates: UpdateProject,
    readonly session: Session
  ) {}
}
