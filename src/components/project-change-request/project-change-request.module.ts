import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ProjectModule } from '../project/project.module';
import { ProjectChangeRequestDrizzleRepository } from './project-change-request.drizzle.repository';
import { ProjectChangeRequestLoader } from './project-change-request.loader';
import { ProjectChangeRequestRepository } from './project-change-request.repository';
import { ProjectChangeRequestResolver } from './project-change-request.resolver';
import { ProjectChangeRequestService } from './project-change-request.service';

@Module({
  imports: [AuthorizationModule, forwardRef(() => ProjectModule)],
  providers: [
    ProjectChangeRequestResolver,
    ProjectChangeRequestService,
    splitDb(ProjectChangeRequestRepository, {
      // Changesets are not carried forward to Postgres; the PG repo answers
      // reads as empty and fails writes loudly.
      // migration-todo: remove with the whole changeset feature at cutover.
      // migration-todo: remove `as any` once splitDb types accept drizzle repos.
      postgres: ProjectChangeRequestDrizzleRepository as any,
    }),
    ProjectChangeRequestLoader,
  ],
  exports: [ProjectChangeRequestService],
})
export class ProjectChangeRequestModule {}
