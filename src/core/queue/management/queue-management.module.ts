import { Module } from '@nestjs/common';
import { QueueManagementService } from './queue-management.service';
import { JobResolver } from './resolvers/job.resolver';
import { QueueResolver } from './resolvers/queue.resolver';

@Module({
  providers: [QueueManagementService, QueueResolver, JobResolver],
})
export class QueueManagementModule {}
