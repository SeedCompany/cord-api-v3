import { Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AdminEdgeDBRepository } from './admin.edgedb.repository';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthorizationModule],
  providers: [AdminService, splitDb(AdminRepository, AdminEdgeDBRepository)],
  exports: [AdminService],
})
export class AdminModule {}
