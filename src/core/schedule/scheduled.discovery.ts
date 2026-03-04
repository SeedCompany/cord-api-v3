import { Injectable } from '@nestjs/common';
import { MetadataDiscovery } from '@seedcompany/nest/discovery';
import { Scheduled } from './scheduled.decorator';
import { Scheduler } from './scheduler.service';

@Injectable()
export class ScheduledDiscovery {
  constructor(
    private readonly discovery: MetadataDiscovery,
    private readonly scheduler: Scheduler,
  ) {}

  onModuleInit() {
    for (const x of this.discovery.discover(Scheduled).methods()) {
      this.scheduler.register(x.meta, [x.instance, x.methodName]);
    }
  }
}
