import { Session, UnsecuredDto } from '../../../common';
import { ProjectChangeRequest } from '../dto';

export class ProjectChangesetAfterFinalizedEvent {
  constructor(
    readonly changeRequest: UnsecuredDto<ProjectChangeRequest>,
    readonly session: Session
  ) {}
}
