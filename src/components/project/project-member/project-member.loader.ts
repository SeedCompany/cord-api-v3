import { ID } from '../../../common';
import { LoaderFactory, OrderedNestDataLoader } from '../../../core';
import { ProjectMember } from './dto';
import { ProjectMemberService } from './project-member.service';

@LoaderFactory(() => ProjectMember)
export class ProjectMemberLoader extends OrderedNestDataLoader<ProjectMember> {
  constructor(private readonly projectMembers: ProjectMemberService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.projectMembers.readMany(ids, this.session);
  }
}
