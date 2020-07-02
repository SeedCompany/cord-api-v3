import { ISession } from '../../../common';
import { Project } from '../dto';

export class ProjectCreatedEvent {
  constructor(readonly project: Project, readonly session: ISession) {}
}
