import { Module } from '@nestjs/common';
import { PostgresModule } from '../../core/postgres/postgres.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthorizationModule, PostgresModule],
  providers: [AdminService, AdminRepository],
  exports: [AdminService],
})
export class AdminModule {}
