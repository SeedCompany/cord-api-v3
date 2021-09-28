import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { UserModule } from '../../user/user.module';
import { ProjectMemberLoader } from './project-member.loader';
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
    ProjectMemberLoader,
  ],
  exports: [ProjectMemberService],
})
export class ProjectMemberModule {}
