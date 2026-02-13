import type { SharedBullConfigurationFactory } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { type QueueOptions } from 'bullmq';
import { ConfigService } from '~/core/config';

@Injectable()
export class BullConfig implements SharedBullConfigurationFactory {
  constructor(private readonly config: ConfigService) {}
  async createSharedConfiguration(): Promise<QueueOptions> {
    const { url, prefix } = this.config.bull;

    let connection: QueueOptions['connection'] | undefined = url
      ? { url }
      : undefined;
    if (!connection) {
      const { RedisMock } = await import('../redis/redis.mock');
      connection = new RedisMock();
    }

    return {
      connection,
      prefix,
      // import { BullMQOtel } from 'bullmq-otel';
      // telemetry: new BullMQOtel(),
    };
  }
}
