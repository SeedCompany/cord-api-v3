import { Module } from '@nestjs/common';
import { UserModule } from '../../user/user.module';
import { ProjectMemberResolver } from './project-member.resolver';
import { ProjectMemberService } from './project-member.service';

@Module({
  imports: [UserModule],
  providers: [ProjectMemberResolver, ProjectMemberService],
  exports: [ProjectMemberService],
})
export class ProjectMemberModule {}
