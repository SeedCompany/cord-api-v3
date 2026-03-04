import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { setInspectOnClass } from '@seedcompany/common';
import { type Cron, type CronCallback } from 'croner';
import cronStringifier from 'cronstrue';
import { ConfigService } from '~/core/config';
import { ILogger, Logger } from '~/core/logger';
import { Scheduler } from './scheduler.service';

/**
 * Pauses scheduled tasks until app boot.
 * Stops scheduled tasks on the app shutdown.
 */
@Injectable()
export class SchedulerImpl
  extends Scheduler
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  @Inject(ConfigService) private readonly config: ConfigService;
  @Logger('scheduler') private readonly logger: ILogger;

  private readonly autostart = new Map<string, () => void>();
  private booted = false;

  get enabled() {
    return !(this.config.isCli || this.config.jest);
  }

  protected override scheduleTask(cron: Cron, fn: () => CronCallback) {
    // Never schedule tasks if not enabled
    if (!this.enabled) {
      return;
    }

    const schedule = () => cron.schedule(fn());

    if (!this.booted) {
      this.autostart.set(cron.name!, schedule);
    } else {
      schedule();
    }

    this.logger.debug('Registered task', {
      name: cron.name,
      schedule: cron.getOnce() ?? cron.getPattern(),
      ...(!!cron.getPattern() && {
        scheduleHuman: cronStringifier.toString(cron.getPattern()!),
      }),
    });
  }

  remove(name: string) {
    this.autostart.delete(name);
    return super.remove(name);
  }

  onApplicationBootstrap() {
    this.booted = true;
    for (const enable of this.autostart.values()) {
      enable();
    }
    this.autostart.clear();
  }

  beforeApplicationShutdown() {
    for (const job of this.jobs.values()) {
      job.stop();
    }
  }
}

setInspectOnClass(SchedulerImpl, () => ({
  type: 'Scheduler',
  include: ['jobs', 'enabled'],
}));
