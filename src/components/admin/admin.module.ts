import { Module } from '@nestjs/common';
import { PostgresModule } from '../../core/postgres/postgres.module';
import { PostgresService } from '../../core/postgres/postgres.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthorizationModule],
  providers: [AdminService, AdminRepository],
  exports: [AdminService],
})
export class AdminModule {}
