import { ID, Session, UnsecuredDto } from '../../../common';
import { Project, UpdateProject } from '../dto';

export class ProjectUpdatedEvent {
  constructor(
    public updated: UnsecuredDto<Project>,
    readonly previous: UnsecuredDto<Project>,
    readonly updates: UpdateProject,
    readonly session: Session,
    readonly changeId?: ID
  ) {}
}
