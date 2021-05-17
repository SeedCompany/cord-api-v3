import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { UserModule } from '../../user/user.module';
import { ProjectMemberRepository } from './project-member.repository';
import { ProjectMemberResolver } from './project-member.resolver';
import { ProjectMemberService } from './project-member.service';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
  ],
  providers: [
    ProjectMemberResolver,
    ProjectMemberService,
    ProjectMemberRepository,
  ],
  exports: [ProjectMemberService, ProjectMemberRepository],
})
export class ProjectMemberModule {}
