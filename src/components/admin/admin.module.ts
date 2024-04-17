import { Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AdminEdgeDBRepository } from './admin.edgedb.repository';
import { AdminEdgeDBService } from './admin.edgedb.service';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';
import { NormalizeCreatorMigration } from './migrations/normalize-creator.migration';

@Module({
  imports: [AuthorizationModule],
  providers: [
    splitDb(AdminService, AdminEdgeDBService),
    splitDb(
      AdminRepository,
      // @ts-expect-error types don't have to match since the service is split
      // and each will only use their own.
      AdminEdgeDBRepository,
    ),
    NormalizeCreatorMigration,
  ],
})
export class AdminModule {}
