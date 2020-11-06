import { Session } from '../../../common';
import { Project } from '../dto';

export class ProjectDeletedEvent {
  constructor(readonly project: Project, readonly session: Session) {}
}
