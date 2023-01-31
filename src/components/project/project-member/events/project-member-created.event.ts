import { Session } from '../../../../common';
import { ProjectMember } from '../dto';

export class ProjectMemberCreatedEvent {
  constructor(public projectMember: ProjectMember, readonly session: Session) {}
}
