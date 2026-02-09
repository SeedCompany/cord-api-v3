import { type UnsecuredDto } from '~/common';
import { type Project } from '../dto';

export class ProjectDeletedHook {
  constructor(readonly project: UnsecuredDto<Project>) {}
}
