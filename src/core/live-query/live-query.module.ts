import { InMemoryLiveQueryStore } from '@n1ru4l/in-memory-live-query-store';
import { Module } from '@nestjs/common';
import { LiveQueryPlugin } from './live-query.plugin';

@Module({
  providers: [
    {
      provide: InMemoryLiveQueryStore,
      useFactory: () => {
        return new InMemoryLiveQueryStore({
          //
        });
      },
    },
    LiveQueryPlugin,
  ],
})
export class LiveQueryModule {}
