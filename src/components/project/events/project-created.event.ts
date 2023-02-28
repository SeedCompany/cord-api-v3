import { Session, UnsecuredDto } from '../../../common';
import { Project } from '../dto';

export class ProjectCreatedEvent {
  constructor(
    public project: UnsecuredDto<Project>,
    readonly session: Session,
  ) {}
}
