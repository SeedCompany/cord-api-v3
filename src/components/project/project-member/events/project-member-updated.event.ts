import { Session } from '../../../../common';
import { ProjectMember, UpdateProjectMember } from '../dto';

export class ProjectMemberUpdatedEvent {
  constructor(
    public updated: ProjectMember,
    readonly previous: ProjectMember,
    readonly updates: UpdateProjectMember,
    readonly session: Session
  ) {}
}
