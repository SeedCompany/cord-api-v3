import { Module } from '@nestjs/common';
import { IEventBus, SyncEventBus } from './event-bus.service';

@Module({
  providers: [SyncEventBus, { provide: IEventBus, useExisting: SyncEventBus }],
  exports: [IEventBus],
})
export class EventsModule {}
