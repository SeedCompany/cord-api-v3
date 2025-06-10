import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { UserModule } from '../../user/user.module';
import { ProjectModule } from '../project.module';
import { AvailableRolesToProjectResolver } from './available-roles-to-project.resolver';
import { DirectorChangeApplyToProjectMembersHandler } from './handlers/director-change-apply-to-project-members.handler';
import { AddInactiveAtMigration } from './migrations/add-inactive-at.migration';
import { ProjectMemberGelRepository } from './project-member.gel.repository';
import { ProjectMemberLoader } from './project-member.loader';
import { ProjectMemberRepository } from './project-member.repository';
import { ProjectMemberResolver } from './project-member.resolver';
import { ProjectMemberService } from './project-member.service';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
    forwardRef(() => ProjectModule),
  ],
  providers: [
    ProjectMemberResolver,
    AvailableRolesToProjectResolver,
    ProjectMemberService,
    splitDb(ProjectMemberRepository, ProjectMemberGelRepository),
    ProjectMemberLoader,
    AddInactiveAtMigration,
    DirectorChangeApplyToProjectMembersHandler,
  ],
  exports: [ProjectMemberService],
})
export class ProjectMemberModule {}
