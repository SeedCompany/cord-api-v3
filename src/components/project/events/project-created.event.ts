import { type UnsecuredDto } from '~/common';
import { type Project } from '../dto';

export class ProjectCreatedEvent {
  constructor(public project: UnsecuredDto<Project>) {}
}
