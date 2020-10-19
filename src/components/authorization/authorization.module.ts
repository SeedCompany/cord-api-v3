import { Module } from '@nestjs/common';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectMemberModule } from '../project/project-member/project-member.module';
import { ProjectModule } from '../project/project.module';
import { AuthorizationResolver } from './authorization.resolver';

@Module({
  imports: [ProjectModule, ProjectMemberModule],
  providers: [AuthorizationResolver, AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
