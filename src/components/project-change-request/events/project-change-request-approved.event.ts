import { type Session, type UnsecuredDto } from '~/common';
import { type ProjectChangeRequest } from '../dto';

export class ProjectChangeRequestApprovedEvent {
  constructor(
    readonly changeRequest: UnsecuredDto<ProjectChangeRequest>,
    readonly session: Session,
  ) {}
}
