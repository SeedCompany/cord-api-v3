import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { ProjectMember } from './dto';
import { ProjectMemberService } from './project-member.service';

@LoaderFactory(() => ProjectMember)
export class ProjectMemberLoader implements DataLoaderStrategy<ProjectMember, ID<ProjectMember>> {
  constructor(private readonly projectMembers: ProjectMemberService) {}

  async loadMany(ids: ReadonlyArray<ID<ProjectMember>>) {
    return await this.projectMembers.readMany(ids);
  }
}
