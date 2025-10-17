import { type DynamicModule, Module } from '@nestjs/common';
import {
  // eslint-disable-next-line @seedcompany/no-restricted-imports
  Broadcaster,
  DurableBroadcaster,
  EventTargetTransport,
  ProxyBroadcaster,
  RedisEventTargetTransport,
  BroadcasterTransport as Transport,
} from '@seedcompany/nest/broadcast';
import Redis from 'ioredis';
import { ConfigService } from '~/core/config';
import { type ILogger, LoggerToken, NestLoggerAdapter } from '~/core/logger';

@Module({
  providers: [
    {
      provide: Broadcaster,
      inject: ['RealBroadcaster'],
      useFactory: (real: Broadcaster): Broadcaster =>
        // Allows dynamic swapping, which will be needed for webhooks
        new ProxyBroadcaster(real),
    },
    // Must be provided as a separate provider so Nest can call lifecycle hooks on it.
    {
      provide: 'RealBroadcaster',
      inject: [Transport, LoggerToken('broadcaster')],
      useFactory: (transport: Transport, logger: ILogger): Broadcaster => {
        const log = new NestLoggerAdapter(logger);
        return new DurableBroadcaster(transport, log);
      },
    },
    {
      provide: Transport,
      inject: [ConfigService, LoggerToken('broadcaster')],
      useFactory: (config: ConfigService, logger: ILogger): Transport => {
        const connStr = config.redis.url;
        if (!connStr) {
          return new EventTargetTransport();
        }

        const client = new Redis(connStr, {
          keyPrefix: 'broadcast:',
          lazyConnect: true,
        });
        client.on('ready', () => {
          logger.info('Redis connection established');
        });
        client.on('error', (err) => {
          logger.error('Redis connection encountered an error', err);
        });
        return new RedisEventTargetTransport(client);
      },
    },
  ],
  exports: [Broadcaster],
})
export class BroadcasterModule {
  static forTest(): DynamicModule {
    return {
      module: BroadcasterModule,
      providers: [{ provide: Transport, useValue: new EventTargetTransport() }],
    };
  }
}
