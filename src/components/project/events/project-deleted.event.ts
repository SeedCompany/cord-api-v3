import { type UnsecuredDto } from '~/common';
import { type Project } from '../dto';

export class ProjectDeletedEvent {
  constructor(readonly project: UnsecuredDto<Project>) {}
}
