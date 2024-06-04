import { Session, UnsecuredDto } from '~/common';
import { ProjectChangeRequest } from '../dto';

export class ProjectChangeRequestApprovedEvent {
  constructor(
    readonly changeRequest: UnsecuredDto<ProjectChangeRequest>,
    readonly session: Session,
  ) {}
}
