import { EnhancedResource, type Session, type UnsecuredDto } from '~/common';
import { type Project, resolveProjectType, type UpdateProject } from '../dto';

export class ProjectUpdatedEvent {
  readonly resource: EnhancedResource<ReturnType<typeof resolveProjectType>>;

  constructor(
    public updated: UnsecuredDto<Project>,
    readonly previous: UnsecuredDto<Project>,
    readonly changes: UpdateProject,
    readonly session: Session,
  ) {
    this.resource = EnhancedResource.of(resolveProjectType(this.updated));
  }
}
