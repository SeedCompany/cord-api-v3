import { InMemoryLiveQueryStore } from '@n1ru4l/in-memory-live-query-store';
import { Module } from '@nestjs/common';
import { LiveQueryStoreImpl } from './live-query-store.impl';
import { LiveQueryStore } from './live-query-store.interface';
import { LiveQueryPlugin } from './live-query.plugin';

@Module({
  providers: [
    {
      provide: LiveQueryStore,
      useClass: LiveQueryStoreImpl,
    },
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
  exports: [LiveQueryStore],
})
export class LiveQueryModule {}
