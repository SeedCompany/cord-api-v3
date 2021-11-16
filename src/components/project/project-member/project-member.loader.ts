import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../../common';
import { OrderedNestDataLoader } from '../../../core';
import { ProjectMember } from './dto';
import { ProjectMemberService } from './project-member.service';

@Injectable({ scope: Scope.REQUEST })
export class ProjectMemberLoader extends OrderedNestDataLoader<ProjectMember> {
  constructor(private readonly projectMembers: ProjectMemberService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.projectMembers.readMany(ids, this.session);
  }
}
