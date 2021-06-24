import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ProjectModule } from '../project/project.module';
import { ChangesetValidationPlugin } from './changeset-validation.plugin';
import { ProjectChangeRequestRepository } from './project-change-request.repository';
import { ProjectChangeRequestResolver } from './project-change-request.resolver';
import { ProjectChangeRequestService } from './project-change-request.service';

@Module({
  imports: [AuthorizationModule, forwardRef(() => ProjectModule)],
  providers: [
    ChangesetValidationPlugin,
    ProjectChangeRequestResolver,
    ProjectChangeRequestService,
    ProjectChangeRequestRepository,
  ],
  exports: [ProjectChangeRequestService],
})
export class ProjectChangeRequestModule {}
