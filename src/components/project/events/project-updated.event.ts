import { Session, UnsecuredDto } from '../../../common';
import { Project, ProjectStep, UpdateProject } from '../dto';

export class ProjectUpdatedEvent {
  constructor(
    public updated: UnsecuredDto<Project>,
    readonly previous: UnsecuredDto<Project>,
    readonly updates: UpdateProject & { step?: ProjectStep },
    readonly session: Session
  ) {}
}
