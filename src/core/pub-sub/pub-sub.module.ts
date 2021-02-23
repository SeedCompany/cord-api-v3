import { Global, Module } from '@nestjs/common';
import { PubSub as InMemoryPubSub, PubSubEngine } from 'graphql-subscriptions';
import { ConfigModule } from '../config/config.module';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PubSubEngine,
      useFactory: () => {
        return new InMemoryPubSub();
      },
    },
  ],
  exports: [PubSubEngine],
})
export class PubSubModule {}
