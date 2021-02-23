import { Global, Module } from '@nestjs/common';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { PubSub as InMemoryPubSub, PubSubEngine } from 'graphql-subscriptions';
import { RedisClient } from 'redis';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PubSubEngine,
      useFactory: (config: ConfigService) => {
        if (config.redis.url) {
          return new RedisPubSub({
            publisher: new RedisClient(config.redis),
            subscriber: new RedisClient(config.redis),
          });
        }
        return new InMemoryPubSub();
      },
      inject: [ConfigService],
    },
  ],
  exports: [PubSubEngine],
})
export class PubSubModule {}
