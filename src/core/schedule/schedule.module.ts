import { Module } from '@nestjs/common';
import { ScheduledTaskModifierResolver } from './resolvers/scheduled-task-modifier.resolver';
import { ScheduledTaskResolver } from './resolvers/scheduled-task.resolver';
import { ScheduledDiscovery } from './scheduled.discovery';
import { SchedulerImpl } from './scheduler.impl';
import { Scheduler } from './scheduler.service';

@Module({
  providers: [
    { provide: Scheduler, useClass: SchedulerImpl },
    ScheduledDiscovery,
    ScheduledTaskResolver,
    ScheduledTaskModifierResolver,
  ],
  exports: [Scheduler],
})
export class ScheduleModule {}
