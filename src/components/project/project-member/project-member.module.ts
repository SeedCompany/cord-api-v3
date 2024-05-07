import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { UserModule } from '../../user/user.module';
import { ProjectModule } from '../project.module';
import { ProjectMemberEdgeDBRepository } from './project-member.edgedb.repository';
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
    ProjectMemberService,
    splitDb(ProjectMemberRepository, ProjectMemberEdgeDBRepository),
    ProjectMemberLoader,
  ],
  exports: [ProjectMemberService],
})
export class ProjectMemberModule {}
