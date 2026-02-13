import { Module } from '@nestjs/common';
import { QueueManagementService } from './queue-management.service';
import { JobModifierResolver } from './resolvers/job-modifier.resolver';
import { JobResolver } from './resolvers/job.resolver';
import { QueueModifierResolver } from './resolvers/queue-modifier.resolver';
import { QueueResolver } from './resolvers/queue.resolver';

@Module({
  providers: [
    QueueManagementService,
    QueueResolver,
    JobResolver,
    QueueModifierResolver,
    JobModifierResolver,
  ],
})
export class QueueManagementModule {}
