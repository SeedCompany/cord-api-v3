import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { AdminDrizzleRepository } from './admin.drizzle.repository';
import { AdminDrizzleService } from './admin.drizzle.service';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';
import { NormalizeCreatorBaseNodeMigration } from './migrations/normalize-creator-base-node.migration';
import { NormalizeCreatorMigration } from './migrations/normalize-creator.migration';

@Module({
  imports: [AuthorizationModule, UserModule],
  providers: [
    splitDb(AdminService, {
      postgres: AdminDrizzleService,
    }),
    splitDb(AdminRepository, {
      // @ts-expect-error types don't have to match since the service is split
      // and each will only use their own.
      postgres: AdminDrizzleRepository,
    }),
    NormalizeCreatorMigration,
    NormalizeCreatorBaseNodeMigration,
  ],
})
export class AdminModule {}
