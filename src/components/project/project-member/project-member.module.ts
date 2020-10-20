import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { UserModule } from '../../user/user.module';
import { ProjectMemberResolver } from './project-member.resolver';
import { ProjectMemberService } from './project-member.service';

@Module({
  imports: [UserModule, forwardRef(() => AuthorizationModule)],
  providers: [ProjectMemberResolver, ProjectMemberService],
  exports: [ProjectMemberService],
})
export class ProjectMemberModule {}
