import { Session, UnsecuredDto } from '../../../common';
import { ProjectChangeRequest } from '../dto';

export class ProjectChangeRequestFinalizedEvent {
  constructor(
    readonly changeRequest: UnsecuredDto<ProjectChangeRequest>,
    readonly session: Session
  ) {}
}
