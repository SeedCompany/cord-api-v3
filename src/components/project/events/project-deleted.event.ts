import { Session, UnsecuredDto } from '~/common';
import { Project } from '../dto';

export class ProjectDeletedEvent {
  constructor(
    readonly project: UnsecuredDto<Project>,
    readonly session: Session,
  ) {}
}
