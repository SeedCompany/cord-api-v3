import { Session } from '../../../../common';
import { ProjectMember } from '../dto';

export class ProjectMemberDeletedEvent {
  constructor(
    readonly projectMember: ProjectMember,
    readonly session: Session
  ) {}
}
