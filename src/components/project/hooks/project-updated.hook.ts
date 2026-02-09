import { EnhancedResource, type UnsecuredDto } from '~/common';
import { type Project, resolveProjectType, type UpdateProject } from '../dto';

export class ProjectUpdatedHook {
  readonly resource: EnhancedResource<ReturnType<typeof resolveProjectType>>;

  constructor(
    public updated: UnsecuredDto<Project>,
    readonly previous: UnsecuredDto<Project>,
    readonly changes: UpdateProject,
  ) {
    this.resource = EnhancedResource.of(resolveProjectType(this.updated));
  }
}
