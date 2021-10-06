import { Session, UnsecuredDto } from '../../../common';
import { ProjectChangeRequest } from '../dto';

export class ProjectChangesetFinalizedEvent {
  constructor(
    readonly changeRequest: UnsecuredDto<ProjectChangeRequest>,
    readonly session: Session
  ) {}
}
