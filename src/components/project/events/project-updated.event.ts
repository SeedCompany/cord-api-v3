import { ISession } from '../../../common';
import { Project, UpdateProject } from '../dto';

export class ProjectUpdatedEvent {
  constructor(
    readonly project: Project,
    readonly updates: UpdateProject,
    readonly session: ISession
  ) {}
}
