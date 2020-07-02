import { Module } from '@nestjs/common';
// eslint-disable-next-line no-restricted-imports
import { CqrsModule, EventBus } from '@nestjs/cqrs';
import { SyncEventBus } from './event-bus.service';

@Module({
  imports: [CqrsModule],
  providers: [SyncEventBus, { provide: EventBus, useExisting: SyncEventBus }],
  exports: [CqrsModule],
})
export class EventsModule {}
