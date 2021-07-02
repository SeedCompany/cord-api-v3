import { Module } from '@nestjs/common';
import { PostgresModule } from '../../core/postgres/postgres.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AdminRepository } from './admin.repository';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthorizationModule, PostgresModule],
  providers: [AdminResolver, AdminService, AdminRepository],
  exports: [AdminService],
})
export class AdminModule {}
