import { ISession } from '../../../common';
import { Project } from '../dto';

export class ProjectCreatedEvent {
  constructor(public project: Project, readonly session: ISession) {}
}
