import { Module } from '@nestjs/common';
import { IEventBus } from './event-bus.service';

@Module({
  providers: [IEventBus],
  exports: [IEventBus],
})
export class EventsModule {}
