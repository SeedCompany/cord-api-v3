import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ProjectChangeRequestRepository } from './project-change-request.repository';
import { ProjectChangeRequestResolver } from './project-change-request.resolver';
import { ProjectChangeRequestService } from './project-change-request.service';

@Module({
  imports: [AuthorizationModule],
  providers: [
    ProjectChangeRequestResolver,
    ProjectChangeRequestService,
    ProjectChangeRequestRepository,
  ],
  exports: [ProjectChangeRequestService],
})
export class ProjectChangeRequestModule {}
