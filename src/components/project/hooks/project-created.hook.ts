import { type UnsecuredDto } from '~/common';
import { type Project } from '../dto';

export class ProjectCreatedHook {
  constructor(public project: UnsecuredDto<Project>) {}
}
