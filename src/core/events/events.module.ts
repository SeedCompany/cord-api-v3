import { Module, OnApplicationBootstrap } from '@nestjs/common';
// eslint-disable-next-line no-restricted-imports
import { CommandBus, EventBus } from '@nestjs/cqrs';
import { ExplorerService } from '@nestjs/cqrs/dist/services/explorer.service';
import { SyncEventBus } from './event-bus.service';

@Module({
  providers: [
    ExplorerService,
    CommandBus,
    { provide: EventBus, useExisting: SyncEventBus },
    SyncEventBus,
  ],
  exports: [EventBus],
})
export class EventsModule implements OnApplicationBootstrap {
  constructor(
    private readonly explorer: ExplorerService,
    private readonly eventBus: SyncEventBus
  ) {}

  onApplicationBootstrap() {
    const { events } = this.explorer.explore();
    this.eventBus.register(events);
  }
}
