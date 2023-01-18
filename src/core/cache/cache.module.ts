import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';
import { ILogger, LoggerToken } from '../logger';
import { CacheBackingService } from './backing.interface';
import { CacheService } from './cache.service';
import { InMemoryCache } from './in-memory.cache';
import { RedisCache } from './redis.cache';

@Module({
  providers: [
    CacheService,
    {
      provide: CacheBackingService,
      inject: [ConfigService, LoggerToken('redis')],
      useFactory: (config: ConfigService, logger: ILogger) => {
        const connStr = config.redis.url;
        if (!connStr) {
          return new InMemoryCache(config.lruCache);
        }
        const redis = new Redis(connStr);
        redis.on('ready', () => {
          logger.info('Connection established');
        });
        redis.on('error', (error) => {
          logger.error('Connection encountered an error', { error });
        });
        return new RedisCache(redis);
      },
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}
