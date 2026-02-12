import type { SharedBullConfigurationFactory } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { type QueueOptions } from 'bullmq';
import { ConfigService } from '~/core/config';

@Injectable()
export class BullConfig implements SharedBullConfigurationFactory {
  constructor(private readonly config: ConfigService) {}
  createSharedConfiguration(): QueueOptions {
    const { url, prefix } = this.config.bull;

    const connection: QueueOptions['connection'] = url ? { url } : {};

    return {
      connection,
      prefix,
      // import { BullMQOtel } from 'bullmq-otel';
      // telemetry: new BullMQOtel(),
    };
  }
}
