import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '~/core/config';
import { Locker } from './locker.service';

@Module({
  providers: [
    {
      provide: Locker,
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<Locker> => {
        const { url, prefix } = config.locker;

        let redis;
        if (url) {
          redis = new Redis(url);
        } else {
          const { RedisMock } = await import('~/core/redis/redis.mock');
          redis = new RedisMock();
        }

        return new Locker(redis, { prefix });
      },
    },
  ],
  exports: [Locker],
})
export class LockerModule {}
