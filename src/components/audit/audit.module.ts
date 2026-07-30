import { forwardRef, Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AuditLogHandler } from './audit-log.handler';
import { AuditService } from './audit.service';
import { ResourceMutationRepository } from './resource-mutation.repository';
import { ResourceMutationResolver } from './resource-mutation.resolver';
import { ResourceHistoryResolver } from './resource.resolver';

@Module({
  imports: [forwardRef(() => UserModule)],
  providers: [
    AuditService,
    ResourceMutationRepository,
    AuditLogHandler,
    ResourceMutationResolver,
    ResourceHistoryResolver,
  ],
  exports: [AuditService],
})
export class AuditModule {}
