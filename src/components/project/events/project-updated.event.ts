import { ISession } from '../../../common';
import { Project, UpdateProject } from '../dto';

export class ProjectUpdatedEvent {
  constructor(
    readonly updated: Project,
    readonly previous: Project,
    readonly updates: UpdateProject,
    readonly session: ISession
  ) {}
}
