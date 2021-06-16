import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EngagementModule } from '../engagement/engagement.module';
import { ProjectModule } from '../project/project.module';
import * as handlers from './handlers';
import { ProjectChangeRequestRepository } from './project-change-request.repository';
import { ProjectChangeRequestResolver } from './project-change-request.resolver';
import { ProjectChangeRequestService } from './project-change-request.service';

@Module({
  imports: [
    AuthorizationModule,
    forwardRef(() => ProjectModule),
    forwardRef(() => EngagementModule),
  ],
  providers: [
    ProjectChangeRequestResolver,
    ProjectChangeRequestService,
    ProjectChangeRequestRepository,
    ...Object.values(handlers),
  ],
  exports: [ProjectChangeRequestService],
})
export class ProjectChangeRequestModule {}
