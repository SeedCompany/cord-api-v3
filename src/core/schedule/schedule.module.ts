import { Module } from '@nestjs/common';
import { ScheduledDiscovery } from './scheduled.discovery';
import { SchedulerImpl } from './scheduler.impl';
import { Scheduler } from './scheduler.service';

@Module({
  providers: [
    { provide: Scheduler, useClass: SchedulerImpl },
    ScheduledDiscovery,
  ],
  exports: [Scheduler],
})
export class ScheduleModule {}
